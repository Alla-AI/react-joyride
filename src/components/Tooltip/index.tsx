import { MouseEvent } from 'react';

import { getText } from '~/modules/helpers';

import { TooltipProps } from '~/types';

import Container from './Container';

export default function Tooltip(props: TooltipProps) {
  const { continuous, helpers, index, isLastStep, setTooltipRef, size, step } = props;
  const { close, next, prev, skip } = helpers;

  const handleClickBack = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();

    prev();
  };

  const handleClickClose = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();

    close('button_close');
  };

  const handleClickPrimary = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();

    if (!continuous) {
      close('button_primary');

      return;
    }

    next();
  };

  const handleClickSkip = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();

    skip();
  };

  const getElementsProps = () => {
    const backLocale = getText(step.locale.back);
    const closeLocale = getText(step.locale.close);
    const lastLocale = getText(step.locale.last);
    const nextLocale = getText(step.locale.next);
    const skipLocale = getText(step.locale.skip);

    let primaryLabel = closeLocale;
    let primaryText = closeLocale;

    if (continuous) {
      primaryLabel = nextLocale;
      primaryText = nextLocale;

      if (step.showProgress && !isLastStep) {
        primaryLabel = getText(step.locale.nextLabelWithProgress)
          .replace('{step}', String(index + 1))
          .replace('{steps}', String(size));
        primaryText = `${nextLocale} (${index + 1}/${size})`;
      }

      if (isLastStep) {
        primaryLabel = lastLocale;
        primaryText = lastLocale;
      }
    }

    return {
      backProps: {
        'aria-label': backLocale,
        'data-action': 'back',
        onClick: handleClickBack,
        role: 'button',
        title: backLocale,
      },
      closeProps: {
        'aria-label': closeLocale,
        'data-action': 'close',
        onClick: handleClickClose,
        role: 'button',
        title: closeLocale,
      },
      primaryProps: {
        'aria-label': primaryLabel,
        'data-action': 'primary',
        onClick: handleClickPrimary,
        role: 'button',
        title: primaryText,
      },
      skipProps: {
        'aria-label': skipLocale,
        'data-action': 'skip',
        onClick: handleClickSkip,
        role: 'button',
        title: skipLocale,
      },
      tooltipProps: {
        'aria-modal': true,
        ref: setTooltipRef,
        role: 'alertdialog',
      },
    };
  };

  const { beaconComponent, tooltipComponent, ...cleanStep } = step;
  let component;

  if (tooltipComponent) {
    const renderProps = {
      ...getElementsProps(),
      continuous,
      index,
      isLastStep,
      size,
      step: cleanStep,
      setTooltipRef,
    };

    const TooltipComponent = tooltipComponent;

    component = <TooltipComponent {...renderProps} />;
  } else {
    component = (
      <Container
        {...getElementsProps()}
        continuous={continuous}
        index={index}
        isLastStep={isLastStep}
        size={size}
        step={step}
      />
    );
  }

  return component;
}
