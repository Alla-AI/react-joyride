import React from 'react';
import PropTypes from 'prop-types';
import Floater from 'react-floater';
import treeChanges from 'tree-changes';
import is from 'is-lite';

import { ACTIONS, EVENTS, LIFECYCLE, STATUS } from '../constants';

import { getElement, isElementVisible, hasPosition } from '../modules/dom';
import { log, hideBeacon } from '../modules/helpers';
import { componentTypeWithRefs } from '../modules/propTypes';
import Scope from '../modules/scope';
import { validateStep } from '../modules/step';

import Beacon from './Beacon';
import Tooltip from './Tooltip/index';

export default class JoyrideStep extends React.Component {
  scope = { removeScope: () => {} };

  static propTypes = {
    action: PropTypes.string.isRequired,
    callback: PropTypes.func.isRequired,
    continuous: PropTypes.bool.isRequired,
    controlled: PropTypes.bool.isRequired,
    debug: PropTypes.bool.isRequired,
    helpers: PropTypes.object.isRequired,
    index: PropTypes.number.isRequired,
    lifecycle: PropTypes.string.isRequired,
    nonce: PropTypes.string,
    setPopper: PropTypes.func.isRequired,
    shouldScroll: PropTypes.bool.isRequired,
    size: PropTypes.number.isRequired,
    status: PropTypes.string.isRequired,
    step: PropTypes.shape({
      beaconComponent: componentTypeWithRefs,
      content: PropTypes.node.isRequired,
      disableBeacon: PropTypes.bool,
      disableOverlay: PropTypes.bool,
      disableOverlayClose: PropTypes.bool,
      disableScrolling: PropTypes.bool,
      disableScrollParentFix: PropTypes.bool,
      event: PropTypes.string,
      floaterProps: PropTypes.shape({
        getPopper: PropTypes.func,
        options: PropTypes.object,
        styles: PropTypes.object,
        wrapperOptions: PropTypes.object,
      }),
      hideBackButton: PropTypes.bool,
      hideCloseButton: PropTypes.bool,
      hideFooter: PropTypes.bool,
      isFixed: PropTypes.bool,
      locale: PropTypes.object,
      offset: PropTypes.number.isRequired,
      placement: PropTypes.oneOf([
        'top',
        'top-start',
        'top-end',
        'bottom',
        'bottom-start',
        'bottom-end',
        'left',
        'left-start',
        'left-end',
        'right',
        'right-start',
        'right-end',
        'auto',
        'center',
      ]),
      spotlightClicks: PropTypes.bool,
      spotlightPadding: PropTypes.number,
      styles: PropTypes.object,
      target: PropTypes.oneOfType([PropTypes.object, PropTypes.string]).isRequired,
      title: PropTypes.node,
      tooltipComponent: componentTypeWithRefs,
    }).isRequired,
    store: PropTypes.shape({
      cleanupPoppers: PropTypes.func.isRequired,
      floaterProps: {
        getPopper: PropTypes.func,
      },
      getPopper: PropTypes.func,
      setPopper: PropTypes.func,
      update: PropTypes.func.isRequired,
    }),
  };

  componentDidMount() {
    const { debug, index } = this.props;

    log({
      title: `step:${index}`,
      data: [{ key: 'props', value: this.props }],
      debug,
    });
  }

  componentDidUpdate(prevProps) {
    const {
      action,
      callback,
      continuous,
      controlled,
      helpers,
      debug,
      index,
      lifecycle,
      size,
      status,
      step,
      store,
    } = this.props;
    const { changed, changedFrom } = treeChanges(prevProps, this.props);
    const state = helpers.info();

    const skipBeacon =
      continuous && action !== ACTIONS.CLOSE && (index > 0 || action === ACTIONS.PREV);
    const hasStoreChanged =
      changed('action') || changed('index') || changed('lifecycle') || changed('status');
    const isInitial = changedFrom('lifecycle', [LIFECYCLE.TOOLTIP, LIFECYCLE.INIT], LIFECYCLE.INIT);

    const isAfterAction = changed('action', [
      ACTIONS.NEXT,
      ACTIONS.PREV,
      ACTIONS.SKIP,
      ACTIONS.CLOSE,
    ]);
    const isControlled = controlled && index === prevProps.index;

    if (isAfterAction && (isInitial || isControlled)) {
      callback({
        ...state,
        index: prevProps.index,
        lifecycle: LIFECYCLE.COMPLETE,
        step: prevProps.step,
        type: EVENTS.STEP_AFTER,
      });
    }

    if (
      step.placement === 'center' &&
      status === STATUS.RUNNING &&
      changed('index') &&
      action !== ACTIONS.START &&
      lifecycle === LIFECYCLE.INIT
    ) {
      store.update({ lifecycle: LIFECYCLE.READY });
    }

    // There's a step to use, but there's no target in the DOM
    if (hasStoreChanged) {
      const element = getElement(step.target);
      const elementExists = !!element;
      const hasRenderedTarget = elementExists && isElementVisible(element);

      if (hasRenderedTarget) {
        if (
          changedFrom('status', STATUS.READY, STATUS.RUNNING) ||
          changedFrom('lifecycle', LIFECYCLE.INIT, LIFECYCLE.READY)
        ) {
          callback({
            ...state,
            step,
            type: EVENTS.STEP_BEFORE,
          });
        }
      } else {
        console.warn(elementExists ? 'Target not visible' : 'Target not mounted', step); //eslint-disable-line no-console
        callback({
          ...state,
          type: EVENTS.TARGET_NOT_FOUND,
          step,
        });

        if (!controlled) {
          store.update({ index: index + (action === ACTIONS.PREV ? -1 : 1) });
        }
      }
    }

    if (changedFrom('lifecycle', LIFECYCLE.INIT, LIFECYCLE.READY)) {
      store.update({
        lifecycle: hideBeacon(step) || skipBeacon ? LIFECYCLE.TOOLTIP : LIFECYCLE.BEACON,
      });
    }

    if (changed('index')) {
      log({
        title: `step:${lifecycle}`,
        data: [{ key: 'props', value: this.props }],
        debug,
      });
    }

    /* istanbul ignore else */
    if (changed('lifecycle', LIFECYCLE.BEACON)) {
      callback({
        ...state,
        step,
        type: EVENTS.BEACON,
      });
    }

    if (changed('lifecycle', LIFECYCLE.TOOLTIP)) {
      callback({
        ...state,
        step,
        type: EVENTS.TOOLTIP,
      });

      this.scope = new Scope(this.tooltip, { selector: '[data-action=primary]' });
      this.scope.setFocus();
    }

    if (changedFrom('lifecycle', [LIFECYCLE.TOOLTIP, LIFECYCLE.INIT], LIFECYCLE.INIT)) {
      this.scope.removeScope();
      store.cleanupPoppers();
    }
  }

  componentWillUnmount() {
    this.scope.removeScope();
  }

  /**
   * Beacon click/hover event listener
   *
   * @param {Event} e
   */
  handleClickHoverBeacon = e => {
    const { step, store } = this.props;

    if (e.type === 'mouseenter' && step.event !== 'hover') {
      return;
    }

    store.update({ lifecycle: LIFECYCLE.TOOLTIP });
  };

  setTooltipRef = c => {
    this.tooltip = c;
  };

  setPopper = (popper, type) => {
    const { action, lifecycle, step, store } = this.props;

    if (type === 'wrapper') {
      store.setPopper('beacon', popper);
    } else {
      store.setPopper('tooltip', popper);
    }

    if (store.getPopper('beacon') && store.getPopper('tooltip') && lifecycle === LIFECYCLE.INIT) {
      store.update({
        action,
        lifecycle: LIFECYCLE.READY,
      });
    }

    if (step.floaterProps?.getPopper) {
      step.floaterProps.getPopper(popper, type);
    }
  };

  get open() {
    const { step, lifecycle } = this.props;

    return !!(hideBeacon(step) || lifecycle === LIFECYCLE.TOOLTIP);
  }

  renderTooltip = renderProps => {
    const { continuous, helpers, index, size, step } = this.props;

    return (
      <Tooltip
        continuous={continuous}
        helpers={helpers}
        index={index}
        isLastStep={index + 1 === size}
        setTooltipRef={this.setTooltipRef}
        size={size}
        step={step}
        {...renderProps}
      />
    );
  };

  render() {
    const { continuous, debug, index, nonce, shouldScroll, size, step } = this.props;
    const target = getElement(step.target);

    if (!validateStep(step) || !is.domElement(target)) {
      return null;
    }

    return (
      <div key={`JoyrideStep-${index}`} className="react-joyride__step">
        <Floater
          {...step.floaterProps}
          component={this.renderTooltip}
          debug={debug}
          getPopper={this.setPopper}
          id={`react-joyride-step-${index}`}
          open={this.open}
          placement={step.placement}
          target={step.target}
        >
          <Beacon
            beaconComponent={step.beaconComponent}
            continuous={continuous}
            index={index}
            isLastStep={index + 1 === size}
            locale={step.locale}
            nonce={nonce}
            onClickOrHover={this.handleClickHoverBeacon}
            shouldFocus={shouldScroll}
            size={size}
            step={step}
            styles={step.styles}
          />
        </Floater>
      </div>
    );
  }
}
