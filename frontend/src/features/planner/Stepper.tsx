interface StepperProps {
  currentStep: number;
  totalSteps: number;
}

export function Stepper({ currentStep, totalSteps }: StepperProps) {
  return (
    <div className="flex items-center gap-2 mb-lg">
      {Array.from({ length: totalSteps }).map((_, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === currentStep;
        const isCompleted = stepNum < currentStep;

        return (
          <div key={stepNum} className="flex items-center">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center font-caption text-caption font-bold ${
                isActive
                  ? "bg-primary-container text-on-primary-container"
                  : isCompleted
                    ? "bg-primary text-on-primary"
                    : "border-2 border-outline-variant text-outline"
              }`}
            >
              {isCompleted ? "✓" : stepNum}
            </div>
            {i < totalSteps - 1 && <div className="h-0.5 w-8 bg-outline-variant mx-1" />}
          </div>
        );
      })}
      <span className="ml-2 font-label-md text-label-md text-on-surface-variant">
        Paso {currentStep} de {totalSteps}
      </span>
    </div>
  );
}
