const steps = [
  {
    view: 'jobs',
    icon: 'J',
    titleKey: 'ingestStepJobsTitle',
    descKey: 'ingestStepJobsDesc',
  },
  {
    view: 'monitoring',
    icon: 'M',
    titleKey: 'ingestStepMonitorTitle',
    descKey: 'ingestStepMonitorDesc',
  },
  {
    view: 'insights',
    icon: 'I',
    titleKey: 'ingestStepInsightsTitle',
    descKey: 'ingestStepInsightsDesc',
  },
  {
    view: 'errors',
    icon: '!',
    titleKey: 'ingestStepErrorsTitle',
    descKey: 'ingestStepErrorsDesc',
  },
];

export function renderIngestWorkflowNav({ activeView, esc, textFor }) {
  return `
    <nav class="ingestWorkflow" aria-label="${esc(textFor('ingestWorkflowAria'))}">
      ${steps
        .map(
          (step, index) => `
            <button
              type="button"
              class="ingestWorkflowItem ${activeView === step.view ? 'active' : ''}"
              data-view="${esc(step.view)}"
            >
              <span class="ingestWorkflowIcon">${esc(step.icon)}</span>
              <span class="ingestWorkflowText">
                <strong>${index + 1}. ${esc(textFor(step.titleKey))}</strong>
                <small>${esc(textFor(step.descKey))}</small>
              </span>
            </button>
          `,
        )
        .join('')}
    </nav>
  `;
}
