import { MouseEvent } from 'react';

import { getText } from '~/modules/helpers';

import { TooltipProps } from '~/types';

import Container from './Container';

export default function Tooltip(props: TooltipProps) {
  const { continuous, helpers, index, isLastStep, setTooltipRef, size, step } = props;

  const handleClickBack = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();

    helpers.prev();
  };

  const handleClickClose = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();

    helpers.close('button_close');
  };

  const handleClickPrimary = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();

    if (!continuous) {
      helpers.close('button_primary');

      return;
    }

    helpers.next();
  };

  const handleClickSkip = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();

    helpers.skip();
  };

  const getElementsProps = () => {
    const back = getText(step.locale.back);
    const close = getText(step.locale.close);
    const last = getText(step.locale.last);
    const next = getText(step.locale.next);
    const skip = getText(step.locale.skip);

    let primaryLabel = close;
    let primaryText = close;

    if (continuous) {
      primaryLabel = next;
      primaryText = next;

      if (step.showProgress && !isLastStep) {
        primaryLabel = getText(step.locale.nextLabelWithProgress)
          .replace('{step}', String(index + 1))
          .replace('{steps}', String(size));
        primaryText = `${next} (${index + 1}/${size})`;
      }

      if (isLastStep) {
        primaryLabel = last;
        primaryText = last;
      }
    }

    return {
      backProps: {
        'aria-label': back,
        'data-action': 'back',
        onClick: handleClickBack,
        role: 'button',
        title: back,
      },
      closeProps: {
        'aria-label': close,
        'data-action': 'close',
        onClick: handleClickClose,
        role: 'button',
        title: close,
      },
      primaryProps: {
        'aria-label': primaryLabel,
        'data-action': 'primary',
        onClick: handleClickPrimary,
        role: 'button',
        title: primaryText,
      },
      skipProps: {
        'aria-label': skip,
        'data-action': 'skip',
        onClick: handleClickSkip,
        role: 'button',
        title: skip,
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
