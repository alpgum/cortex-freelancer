/**
 * Experiment registry.
 * Keep this file small + editable.
 */

const EXPERIMENTS = {
  transport_method_v1: {
    description: 'Choose client transport/update mechanism for chat/queue results',
    salt: 'cfx-044-transport-method-v1',
    variants: [
      { key: 'sse', weight: 0.45 },
      { key: 'polling', weight: 0.30 },
      { key: 'socketio', weight: 0.20 },
      { key: 'ws', weight: 0.05 }
    ]
  },

  chat_ui_v1: {
    description: 'UI variants for chat layout and loading states',
    salt: 'cfx-044-chat-ui-v1',
    variants: [
      { key: 'control', weight: 0.50 },
      { key: 'compact', weight: 0.25 },
      { key: 'loading_skeleton', weight: 0.25 }
    ]
  }
};

module.exports = { EXPERIMENTS };
