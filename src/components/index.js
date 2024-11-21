import React from 'react';
import PropTypes from 'prop-types';
import treeChanges from 'tree-changes';
import is from 'is-lite';

import {
  getElement,
  getScrollParent,
  getScrollTo,
  hasCustomScrollParent,
  hasPosition,
  scrollTo,
} from '../modules/dom';
import { canUseDOM, isEqual, log, shouldScroll } from '../modules/helpers';
import { componentTypeWithRefs } from '../modules/propTypes';
import { getMergedStep, validateSteps } from '../modules/step';
import Overlay from './Overlay';
import Portal from './Portal';
import { ACTIONS, EVENTS, LIFECYCLE, STATUS } from '../constants';
import createStore from '../modules/store';

import Step from './Step';

class Joyride extends React.Component {
  constructor(props) {
    super(props);

    const { debug, getHelpers, run, stepIndex } = props;

    this.store = createStore({
      ...props,
      controlled: run && is.number(stepIndex),
    });
    this.helpers = this.store.getHelpers();

    const { addListener } = this.store;

    log({
      title: 'init',
      data: [
        { key: 'props', value: this.props },
        { key: 'state', value: this.state },
      ],
      debug,
    });

    // Sync the store to this component's state.
    addListener(this.syncState);

    if (getHelpers) {
      getHelpers(this.helpers);
    }

    this.state = this.store.getState();
  }

  static propTypes = {
    beaconComponent: componentTypeWithRefs,
    callback: PropTypes.func,
    continuous: PropTypes.bool,
    debug: PropTypes.bool,
    disableCloseOnEsc: PropTypes.bool,
    disableOverlay: PropTypes.bool,
    disableOverlayClose: PropTypes.bool,
    disableScrolling: PropTypes.bool,
    disableScrollParentFix: PropTypes.bool,
    floaterProps: PropTypes.shape({
      options: PropTypes.object,
      styles: PropTypes.object,
      wrapperOptions: PropTypes.object,
    }),
    getHelpers: PropTypes.func,
    hideBackButton: PropTypes.bool,
    locale: PropTypes.object,
    nonce: PropTypes.string,
    run: PropTypes.bool,
    scrollDuration: PropTypes.number,
    scrollOffset: PropTypes.number,
    scrollToFirstStep: PropTypes.bool,
    showProgress: PropTypes.bool,
    showSkipButton: PropTypes.bool,
    spotlightClicks: PropTypes.bool,
    spotlightPadding: PropTypes.number,
    stepIndex: PropTypes.number,
    steps: PropTypes.array,
    styles: PropTypes.object,
    tooltipComponent: componentTypeWithRefs,
  };

  static defaultProps = {
    continuous: false,
    debug: false,
    disableCloseOnEsc: false,
    disableOverlay: false,
    disableOverlayClose: false,
    disableScrolling: false,
    disableScrollParentFix: false,
    getHelpers: () => {},
    hideBackButton: false,
    run: true,
    scrollOffset: 20,
    scrollDuration: 300,
    scrollToFirstStep: false,
    showSkipButton: false,
    showProgress: false,
    spotlightClicks: false,
    spotlightPadding: 10,
    steps: [],
  };

  componentDidMount() {
    if (!canUseDOM) return;

    const { disableCloseOnEsc, debug, run, steps } = this.props;
    const { start } = this.store;

    if (validateSteps(steps, debug) && run) {
      start();
    }

    /* istanbul ignore else */
    if (!disableCloseOnEsc) {
      document.body.addEventListener('keydown', this.handleKeyboard, { passive: true });
    }
  }

  componentDidUpdate(prevProps, prevState) {
    if (!canUseDOM) return;

    const { action, controlled, index, lifecycle, status } = this.state;
    const { debug, run, stepIndex, steps } = this.props;
    const { steps: prevSteps, stepIndex: prevStepIndex } = prevProps;
    const { reset, setSteps, start, stop, update } = this.store;
    const { changed: changedProps } = treeChanges(prevProps, this.props);
    const { changed, changedFrom } = treeChanges(prevState, this.state);
    const step = getMergedStep(steps[index], this.props);

    const stepsChanged = !isEqual(prevSteps, steps);
    const stepIndexChanged = is.number(stepIndex) && changedProps('stepIndex');
    const target = getElement(step?.target);

    if (stepsChanged) {
      if (validateSteps(steps, debug)) {
        setSteps(steps);
      } else {
        console.warn('Steps are not valid', steps); //eslint-disable-line no-console
      }
    }

    /* istanbul ignore else */
    if (changedProps('run')) {
      if (run) {
        start(stepIndex);
      } else {
        stop();
      }
    }

    /* istanbul ignore else */
    if (stepIndexChanged) {
      let nextAction = prevStepIndex < stepIndex ? ACTIONS.NEXT : ACTIONS.PREV;

      if (action === ACTIONS.STOP) {
        nextAction = ACTIONS.START;
      }

      if (![STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
        update({
          action: action === ACTIONS.CLOSE ? ACTIONS.CLOSE : nextAction,
          index: stepIndex,
          lifecycle: LIFECYCLE.INIT,
        });
      }
    }

    // Update the index if the first step is not found
    if (!controlled && status === STATUS.RUNNING && index === 0 && !target) {
      this.store.update({ index: index + 1 });
      this.callback({
        ...this.state,
        type: EVENTS.TARGET_NOT_FOUND,
        step,
      });
    }

    const callbackData = {
      ...this.state,
      index,
      step,
    };
    const isAfterAction = changed('action', [
      ACTIONS.NEXT,
      ACTIONS.PREV,
      ACTIONS.SKIP,
      ACTIONS.CLOSE,
    ]);

    if (isAfterAction && changed('status', STATUS.PAUSED)) {
      const prevStep = getMergedStep(steps[prevState.index], this.props);

      this.callback({
        ...callbackData,
        index: prevState.index,
        lifecycle: LIFECYCLE.COMPLETE,
        step: prevStep,
        type: EVENTS.STEP_AFTER,
      });
    }

    if (changed('status', [STATUS.FINISHED, STATUS.SKIPPED])) {
      const prevStep = getMergedStep(steps[prevState.index], this.props);

      if (!controlled) {
        this.callback({
          ...callbackData,
          index: prevState.index,
          lifecycle: LIFECYCLE.COMPLETE,
          step: prevStep,
          type: EVENTS.STEP_AFTER,
        });
      }
      this.callback({
        ...callbackData,
        index: prevState.index,
        // Return the last step when the tour is finished
        step: prevStep,
        type: EVENTS.TOUR_END,
      });
      reset();
    } else if (changedFrom('status', [STATUS.IDLE, STATUS.READY], STATUS.RUNNING)) {
      this.callback({
        ...callbackData,
        type: EVENTS.TOUR_START,
      });
    } else if (changed('status') || changed('action', ACTIONS.RESET)) {
      this.callback({
        ...callbackData,
        type: EVENTS.TOUR_STATUS,
      });
    }
    this.scrollToStep(prevState);

    if (step.placement === 'center' && status === STATUS.RUNNING && lifecycle === LIFECYCLE.INIT) {
      this.store.update({ lifecycle: LIFECYCLE.READY });
    }
  }

  componentWillUnmount() {
    const { disableCloseOnEsc } = this.props;

    /* istanbul ignore else */
    if (!disableCloseOnEsc) {
      document.body.removeEventListener('keydown', this.handleKeyboard);
    }
  }

  callback = data => {
    const { callback } = this.props;

    if (is.function(callback)) {
      callback(data);
    }
  };

  /**
   * Keydown event listener
   *
   * @private
   * @param {Event} e - Keyboard event
   */
  handleKeyboard = event => {
    const { index, lifecycle } = this.state;
    const { steps } = this.props;
    const step = steps[index];

    if (lifecycle === LIFECYCLE.TOOLTIP) {
      if (event.code === 'Escape' && step && !step.disableCloseOnEsc) {
        this.store.close('keyboard');
      }
    }
  };

  handleClickOverlay = () => {
    const { index } = this.state;
    const { steps } = this.props;

    const step = getMergedStep(this.props, steps[index]);

    if (!step.disableOverlayClose) {
      this.helpers.close('overlay');
    }
  };

  /**
   * Sync the store with the component's state
   */
  syncState = state => {
    this.setState(state);
  };

  scrollToStep(prevState) {
    const { index, lifecycle, status } = this.state;
    const {
      debug,
      disableScrollParentFix = false,
      scrollToFirstStep = false,
      scrollOffset = 20,
      scrollDuration,
      steps,
    } = this.props;
    const step = getMergedStep(steps[index], this.props);
    const target = getElement(step.target);
    const shouldScrollToStep = shouldScroll({
      isFirstStep: index === 0,
      lifecycle,
      previousLifecycle: prevState.lifecycle,
      scrollToFirstStep,
      step,
      target,
    });
    if (status === STATUS.RUNNING && shouldScrollToStep) {
      const hasCustomScroll = hasCustomScrollParent(target, disableScrollParentFix);
      const scrollParent = getScrollParent(target, disableScrollParentFix);
      let scrollY = Math.floor(getScrollTo(target, scrollOffset, disableScrollParentFix)) || 0;

      log({
        title: 'scrollToStep',
        data: [
          { key: 'index', value: index },
          { key: 'lifecycle', value: lifecycle },
          { key: 'status', value: status },
        ],
        debug,
      });
      const beaconPopper = this.store.getPopper('beacon');
      const tooltipPopper = this.store.getPopper('tooltip');

      if (lifecycle === LIFECYCLE.BEACON && beaconPopper) {
        const { offsets, placement } = beaconPopper;

        if (!['bottom'].includes(placement) && !hasCustomScroll) {
          scrollY = Math.floor(offsets.popper.top - scrollOffset);
        }
      } else if (lifecycle === LIFECYCLE.TOOLTIP && tooltipPopper) {
        const { flipped, offsets, placement } = tooltipPopper;

        if (['top', 'right', 'left'].includes(placement) && !flipped && !hasCustomScroll) {
          scrollY = Math.floor(offsets.popper.top - scrollOffset);
        } else {
          scrollY -= step.spotlightPadding;
        }
      }

      scrollY = scrollY >= 0 ? scrollY : 0;

      if (status === STATUS.RUNNING) {
        scrollTo(scrollY, { element: scrollParent, duration: scrollDuration }).then(() => {
          setTimeout(() => {
            this.store.getPopper('tooltip')?.instance.update();
          }, 10);
        });
      }
    }
  }

  render() {
    if (!canUseDOM) return null;

    const { index, lifecycle, status } = this.state;
    const {
      continuous = false,
      debug = false,
      nonce,
      scrollToFirstStep = false,
      steps,
    } = this.props;
    const isRunning = status === STATUS.RUNNING;
    const content = {};

    if (isRunning && steps[index]) {
      const step = getMergedStep(steps[index], this.props);
      content.step = (
        <Step
          {...this.state}
          callback={this.callback}
          continuous={continuous}
          debug={debug}
          helpers={this.helpers}
          nonce={nonce}
          shouldScroll={!step.disableScrolling && (index !== 0 || scrollToFirstStep)}
          step={step}
          store={this.store}
        />
      );

      content.overlay = (
        <Portal id="react-joyride-portal">
          <Overlay
            {...step}
            continuous={continuous}
            debug={debug}
            lifecycle={lifecycle}
            onClickOverlay={this.handleClickOverlay}
          />
        </Portal>
      );
    }

    return (
      <div className="react-joyride">
        {content.step}
        {content.overlay}
      </div>
    );
  }
}

export default Joyride;
