/** Self-hosted [Pixelarticons](https://github.com/halfmage/pixelarticons) (MIT). */
(() => {
  const ICONS = {
    menu: '<path d="M20 18H4v-2h16v2Zm0-5H4v-2h16v2Zm0-5H4V6h16v2Z"/>',
    close: '<path d="M7 19H5V17H7V19ZM19 19H17V17H19V19ZM9 15V17H7V15H9ZM17 17H15V15H17V17ZM11 15H9V13H11V15ZM15 15H13V13H15V15ZM13 13H11V11H13V13ZM11 11H9V9H11V11ZM15 11H13V9H15V11ZM9 9H7V7H9V9ZM17 9H15V7H17V9ZM7 7H5V5H7V7ZM19 7H17V5H19V7Z"/>',
    moon: '<path d="M18 22H8v-2h10v2ZM8 20H6v-2h2v2Zm12 0h-2v-2h2v2ZM6 18H4v-2h2v2Zm16 0h-2v-4h-2v-2h2v-2h2v8ZM4 16H2V6h2v10Zm14 0h-6v-2h6v2Zm-6-2h-2v-2h2v2Zm-2-2H8V6h2v6ZM6 6H4V4h2v2Zm8-2h-2v2h-2V4H6V2h8v2Z"/>',
    sun: '<path d="M11 1h2v4h-2V1Zm0 18h2v4h-2v-4ZM1 11h4v2H1v-2Zm18 0h4v2h-4v-2ZM9 9h6v6H9V9ZM5 5h3v3H5V5Zm16 0h-3v3h3V5ZM5 16h3v3H5v-3Zm16 0h-3v3h3v-3Z"/>',
    check: '<path d="M10 18H8v-2h2v2Zm-2-2H6v-2h2v2Zm4-2v2h-2v-2h2Zm-6 0H4v-2h2v2Zm8 0h-2v-2h2v2Zm2-2h-2v-2h2v2Zm2-2h-2V8h2v2Zm2-2h-2V6h2v2Z"/>',
    plus: '<path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7V4Z"/>',
    'external-link': '<path d="M11 5H5v2h6V5ZM5 7H3v12h2V7Zm12 12H5v2h12v-2Zm2-6h-2v6h2v-6Zm-8 0H9v2h2v-2Zm2-2h-2v2h2v-2Zm2-2h-2v2h2V9Zm2-2h-2v2h2V7Zm2-2h-2v2h2V5Zm2-2h-2v8h2V3Z"/><path d="M21 3h-8v2h8V3Z"/>',
    'chevron-up': '<path d="M13 8h-2v2h2V8Zm-2 2H9v2h2v-2Zm4 0h-2v2h2v-2Zm-6 2H7v2h2v-2Zm8 0h-2v2h2v-2ZM7 14H5v2h2v-2Zm12 0h-2v2h2v-2Z"/>',
    'chevron-down': '<path d="M13 16h-2v-2h2v2Zm-2-2H9v-2h2v2Zm4 0h-2v-2h2v2Zm-6-2H7v-2h2v2Zm8 0h-2v-2h2v2ZM7 10H5V8h2v2Zm12 0h-2V8h2v2Z"/>',
    delete: '<path d="M6 7h2v2H6zm14 0h2v10h-2zM8 5h12v2H8zM4 9h2v2H4zm-2 2h2v2H2zm2 2h2v2H4zm2 2h2v2H6zm2 2h12v2H8zm6-6h2v2h-2zm2 2h2v2h-2zm0-4h2v2h-2zm-4 4h2v2h-2zm0-4h2v2h-2z"/>',
    mail: '<path d="M6 8h2v2H6zm2 2h2v2H8zm10-2h-2v2h2zm-2 2h-2v2h2zm-6 2h4v2h-4zM2 6h2v12H2zm18 0h2v12h-2zM4 4h16v2H4zm0 14h16v2H4z"/>',
    message: '<path d="M20 2H4v2h16zm0 14H6v2h14zm2-12h-2v12h2zM4 4H2v18h2zm2 14H4v2h2z"/>',
    chat: '<path d="M20 2H4v2h16zm0 14H6v2h14zm2-12h-2v12h2zM4 4H2v18h2zm2 14H4v2h2zm0-6h4v2H6zm0-4h8v2H6z"/>',
  };

  const SHADOW_STYLE = `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      line-height: 0;
      color: inherit;
      vertical-align: middle;
    }
    svg {
      display: block;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
    }
  `;

  class PxIcon extends HTMLElement {
    static get observedAttributes() {
      return ['name', 'size'];
    }

    constructor() {
      super();
      this._root = this.attachShadow({ mode: 'open' });
      this._style = document.createElement('style');
      this._style.textContent = SHADOW_STYLE;
      this._mount = document.createElement('span');
      this._root.append(this._style, this._mount);
    }

    connectedCallback() {
      this.render();
    }

    attributeChangedCallback() {
      if (!this.isConnected) return;
      this.render();
    }

    render() {
      const name = this.getAttribute('name') || '';
      const size = this.getAttribute('size') || '24';
      const paths = ICONS[name];
      if (!paths) {
        this._mount.innerHTML = '';
        return;
      }
      this._mount.innerHTML =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
    }
  }

  if (!customElements.get('px-icon')) {
    customElements.define('px-icon', PxIcon);
  }
})();
