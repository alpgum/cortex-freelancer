/**
 * CF-130: Project Tracker — add Kanban board view
 * Drag-and-drop Kanban (To Do / In Progress / Review / Done) for project tasks.
 */
(function () {
  'use strict';
  window.CortexFreelancer = window.CortexFreelancer || {};

  const STORAGE_KEY = 'cf_kanban_board';

  const KanbanBoard = {
    COLUMNS: ['todo', 'in_progress', 'review', 'done'],
    COLUMN_LABELS: {
      todo: 'To Do',
      in_progress: 'In Progress',
      review: 'Review',
      done: 'Done'
    },
    COLUMN_COLORS: {
      todo: '#6c63ff',
      in_progress: '#ffd93d',
      review: '#4d96ff',
      done: '#6bcb77'
    },

    tasks: {},
    draggedTask: null,

    init() {
      this.load();
      document.addEventListener('DOMContentLoaded', () => this.render());
    },

    load() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        this.tasks = saved ? JSON.parse(saved) : {
          todo: [],
          in_progress: [],
          review: [],
          done: []
        };
      } catch (e) {
        this.tasks = { todo: [], in_progress: [], review: [], done: [] };
      }
    },

    save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tasks));
      } catch (e) {
        console.warn('[CF-130] Failed to save kanban:', e);
      }
    },

    addTask(column, title, description, priority) {
      const task = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        title,
        description: description || '',
        priority: priority || 'medium',
        createdAt: Date.now()
      };
      if (!this.tasks[column]) this.tasks[column] = [];
      this.tasks[column].push(task);
      this.save();
      this.render();
      return task;
    },

    moveTask(taskId, fromColumn, toColumn) {
      const fromTasks = this.tasks[fromColumn];
      if (!fromTasks) return;
      const idx = fromTasks.findIndex(t => t.id === taskId);
      if (idx === -1) return;
      const [task] = fromTasks.splice(idx, 1);
      if (!this.tasks[toColumn]) this.tasks[toColumn] = [];
      this.tasks[toColumn].push(task);
      this.save();
      this.render();
    },

    deleteTask(taskId, column) {
      if (!this.tasks[column]) return;
      this.tasks[column] = this.tasks[column].filter(t => t.id !== taskId);
      this.save();
      this.render();
    },

    render() {
      const container = document.querySelector('#kanban-board, [data-kanban]');
      if (!container) return;

      container.innerHTML = '';
      container.style.cssText = 'display: flex; gap: 16px; overflow-x: auto; padding: 16px 0; min-height: 400px;';

      this.COLUMNS.forEach(colId => {
        const col = document.createElement('div');
        col.className = 'kanban-column';
        col.dataset.column = colId;
        col.style.cssText = `
          flex: 1; min-width: 220px; background: var(--bg-secondary, #f8f9fa);
          border-radius: 12px; padding: 12px; display: flex; flex-direction: column;
        `;

        const header = document.createElement('div');
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;';
        header.innerHTML = `
          <h4 style="margin: 0; display: flex; align-items: center; gap: 8px;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${this.COLUMN_COLORS[colId]};"></span>
            ${this.COLUMN_LABELS[colId]}
            <span style="font-size: 12px; color: var(--text-muted, #999); font-weight: normal;">
              ${(this.tasks[colId] || []).length}
            </span>
          </h4>
        `;

        if (colId === 'todo') {
          const addBtn = document.createElement('button');
          addBtn.textContent = '+';
          addBtn.style.cssText = 'border: none; background: var(--accent, #6c63ff); color: #fff; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; font-size: 16px; line-height: 1;';
          addBtn.addEventListener('click', () => {
            const title = prompt('Task title:');
            if (title) this.addTask('todo', title);
          });
          header.appendChild(addBtn);
        }

        col.appendChild(header);

        const taskList = document.createElement('div');
        taskList.className = 'kanban-task-list';
        taskList.dataset.column = colId;
        taskList.style.cssText = 'flex: 1; min-height: 60px;';

        // Drop zone
        taskList.addEventListener('dragover', (e) => {
          e.preventDefault();
          taskList.style.background = 'var(--accent, #6c63ff)22';
        });
        taskList.addEventListener('dragleave', () => {
          taskList.style.background = '';
        });
        taskList.addEventListener('drop', (e) => {
          e.preventDefault();
          taskList.style.background = '';
          if (this.draggedTask) {
            this.moveTask(this.draggedTask.id, this.draggedTask.from, colId);
            this.draggedTask = null;
          }
        });

        (this.tasks[colId] || []).forEach(task => {
          const card = this.createTaskCard(task, colId);
          taskList.appendChild(card);
        });

        col.appendChild(taskList);
        container.appendChild(col);
      });
    },

    createTaskCard(task, column) {
      const card = document.createElement('div');
      card.className = 'kanban-card';
      card.draggable = true;
      card.style.cssText = `
        background: var(--bg-card, #fff); border: 1px solid var(--border-color, #e0e0e0);
        border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; cursor: grab;
        transition: box-shadow 0.2s;
      `;

      const priorityColors = { high: '#dc3545', medium: '#ffc107', low: '#28a745' };
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <span style="font-size: 14px; font-weight: 500;">${this.escapeHtml(task.title)}</span>
          <button class="kanban-delete" style="border: none; background: none; cursor: pointer; color: var(--text-muted, #999); font-size: 14px; padding: 0 4px;">&times;</button>
        </div>
        ${task.description ? `<p style="font-size: 12px; color: var(--text-muted, #999); margin: 4px 0 0;">${this.escapeHtml(task.description)}</p>` : ''}
        <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${priorityColors[task.priority] || '#ffc107'}; margin-top: 6px;"></span>
      `;

      card.addEventListener('dragstart', () => {
        this.draggedTask = { id: task.id, from: column };
        card.style.opacity = '0.5';
      });
      card.addEventListener('dragend', () => {
        card.style.opacity = '1';
      });

      card.querySelector('.kanban-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteTask(task.id, column);
      });

      return card;
    },

    escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    },

    getStats() {
      return {
        todo: (this.tasks.todo || []).length,
        inProgress: (this.tasks.in_progress || []).length,
        review: (this.tasks.review || []).length,
        done: (this.tasks.done || []).length,
        total: this.COLUMNS.reduce((sum, col) => sum + (this.tasks[col] || []).length, 0)
      };
    }
  };

  KanbanBoard.init();
  window.CortexFreelancer.KanbanBoard = KanbanBoard;
})();
