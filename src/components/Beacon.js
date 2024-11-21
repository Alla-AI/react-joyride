import React from 'react';
import PropTypes from 'prop-types';
import is from 'is-lite';
import { componentTypeWithRefs } from '../modules/propTypes';

export default class JoyrideBeacon extends React.Component {
  constructor(props) {
    super(props);

    if (props.beaconComponent) {
      return;
    }

    const head = document.head || document.getElementsByTagName('head')[0];
    const style = document.createElement('style');

    style.id = 'joyride-beacon-animation';

    if (props.nonce) {
      style.setAttribute('nonce', props.nonce);
    }

    const css = `
        @keyframes joyride-beacon-inner {
          20% {
            opacity: 0.9;
          }
        
          90% {
            opacity: 0.7;
          }
        }
        
        @keyframes joyride-beacon-outer {
          0% {
            transform: scale(1);
          }
        
          45% {
            opacity: 0.7;
            transform: scale(0.75);
          }
        
          100% {
            opacity: 0.9;
            transform: scale(1);
          }
        }
      `;

    style.appendChild(document.createTextNode(css));

    head.appendChild(style);
  }

  static propTypes = {
    beaconComponent: componentTypeWithRefs,
    continuous: PropTypes.bool,
    index: PropTypes.number,
    isLastStep: PropTypes.bool,
    locale: PropTypes.object.isRequired,
    nonce: PropTypes.string,
    onClickOrHover: PropTypes.func.isRequired,
    shouldFocus: PropTypes.bool.isRequired,
    size: PropTypes.number,
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
    styles: PropTypes.object.isRequired,
  };

  componentDidMount() {
    const { shouldFocus } = this.props;
    if (process.env.NODE_ENV !== 'production') {
      if (!is.domElement(this.beacon)) {
        console.warn('beacon is not a valid DOM element'); //eslint-disable-line no-console
      }
    }

    setTimeout(() => {
      if (is.domElement(this.beacon) && shouldFocus) {
        this.beacon.focus();
      }
    }, 0);
  }

  componentWillUnmount() {
    const style = document.getElementById('joyride-beacon-animation');

    if (style?.parentNode) {
      style.parentNode.removeChild(style);
    }
  }

  setBeaconRef = c => {
    this.beacon = c;
  };

  render() {
    const {
      beaconComponent,
      continuous,
      index,
      isLastStep,
      locale,
      onClickOrHover,
      size,
      step,
      styles,
    } = this.props;
    const sharedProps = {
      'aria-label': locale.open,
      onClick: onClickOrHover,
      onMouseEnter: onClickOrHover,
      ref: this.setBeaconRef,
      title: locale.open,
    };
    let component;

    if (beaconComponent) {
      const BeaconComponent = beaconComponent;
      component = (
        <BeaconComponent
          continuous={continuous}
          index={index}
          isLastStep={isLastStep}
          size={size}
          step={step}
          {...sharedProps}
        />
      );
    } else {
      component = (
        <button
          key="JoyrideBeacon"
          className="react-joyride__beacon"
          style={styles.beacon}
          type="button"
          data-test-id="button-beacon"
          {...sharedProps}
        >
          <span style={styles.beaconInner} />
          <span style={styles.beaconOuter} />
        </button>
      );
    }

    return component;
  }
}
