---
name: Feature Request
description: Suggest an idea for this application
title: "[FEATURE] "
labels: ["enhancement"]
assignees: []
body:
  - type: markdown
    attributes:
      value: |
        Thanks for taking the time to suggest a feature!

  - type: textarea
    id: feature-description
    attributes:
      label: Feature Description
      description: A clear and concise description of the feature you'd like to see
      placeholder: What would you like to see added?
    validations:
      required: true

  - type: textarea
    id: problem-solved
    attributes:
      label: Problem Statement
      description: Is your feature request related to a problem? If so, please describe it
      placeholder: I'm frustrated when...

  - type: textarea
    id: proposed-solution
    attributes:
      label: Proposed Solution
      description: Describe the solution you'd like to see implemented
      placeholder: I would like to see...

  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives Considered
      description: Describe any alternative solutions or features you've considered
      placeholder: I also considered...

  - type: dropdown
    id: priority
    attributes:
      label: Priority
      description: How important is this feature to you?
      options:
        - Low (Nice to have)
        - Medium (Would use it)
        - High (Really need it)
        - Critical (Can't use without it)
    validations:
      required: true

  - type: textarea
    id: additional-context
    attributes:
      label: Additional Context
      description: Add any other context, screenshots, or examples about the feature request
      placeholder: Any additional information...

  - type: checkboxes
    id: terms
    attributes:
      label: Checklist
      description: Please confirm the following
      options:
        - label: I have searched existing feature requests to ensure this is not a duplicate
          required: true
        - label: I have provided enough detail for the team to understand this request
          required: true
        - label: I am willing to help implement this feature if needed
          required: false