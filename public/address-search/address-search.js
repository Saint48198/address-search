class AddressSearch extends HTMLElement {
    static DEFAULT_DEBOUNCE_MS = 300;
    static WAIT_FOR_FETCH = false;
    static FETCH_TIMEOUT_MS = 2000;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.selectedIndex = -1;
        this.results = [];
        this.debounceTimeout = null;
        this.abortController = null;

        // pre-bind handlers
        this.onInput = this.onInput.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onClick = this.onClick.bind(this);

        this.shadowRoot.innerHTML = `
      <style>
        .container {
          position: relative;
          width: 100%;
        }
        .input-wrapper {
          align-items: center;
          position: relative;
        }
        input {
          width: 100%;
          box-sizing: border-box;
          padding: 10px 36px 10px 10px;
        }
        button.action {
          position: absolute;
          right: 4px;
          top: 50%;
          transform: translateY(-50%);
          width: 28px;
          height: 28px;
          border: none;
          border-radius: 50%;
          background-color: #666;
          color: white;
          font-size: 22px;
          font-family: "Segoe UI", "Roboto", sans-serif;
          font-weight: 100;
          line-height: 1;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          margin: 0;
          transition: background-color 0.2s ease, transform 0.1s ease;
        }
  
        button.action:hover {
          background-color: #444;
        }
  
        button.action:focus {
          outline: 2px solid #888;
          outline-offset: 2px;
        }
  
        button.action:active {
          background-color: #222;
          transform: translateY(-50%) scale(0.95);
        }
  
        ul {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          margin: 0;
          padding: 0;
          list-style: none;
          background: white;
          border: 1px solid #ccc;
          /* max-height: 200px;*/
          overflow-y: auto;
          z-index: 1000;
        }
        .center {
           text-align: center;
        }
        li { /* top right bottom left */
          padding: 0.15em 10px 0 1.7em;
          text-indent: -1.5em;
          cursor: pointer;
        }
        li.highlight {
          background-color: #f0f0f0;
        }
        .centered-text {
          text-align: center;
        }
      </style>
      <div class="container">
        <div class="input-wrapper">
            <input type="text" placeholder="Enter address like: 123 Main, MyCity" />
            <button class="action" type="button" title="Clear address bar">&times;</button>
        </div>
        <ul hidden></ul>
      </div>
    `;
    }

    connectedCallback() {
        this.input = this.shadowRoot.querySelector('input');
        this.list = this.shadowRoot.querySelector('ul');
        this.actionButton = this.shadowRoot.querySelector('button.action');

        this.input.addEventListener('input', e => {
            console.log('Input event triggered', this.constructor.WAIT_FOR_FETCH && this.input.disabled);
            if (this.constructor.WAIT_FOR_FETCH && this.input.disabled) {
                e.preventDefault();
                return;
            }
            this.onInput();
        });
        this.input.addEventListener('keydown', this.onKeyDown);
        this.list.addEventListener('click', this.onClick);
        this.actionButton.addEventListener('click', () => {
            this.input.value = '';
            this.clearList();
            this.input.focus();
        });
    }

    onInput() {
        const value = this.input.value.trim();
        this.selectedIndex = -1;

        if (value.length < 3) {
            this.clearList();
            return;
        }

        clearTimeout(this.debounceTimeout);
        this.debounceTimeout = setTimeout(() => {
            this.fetchSuggestions(value);
        }, this.constructor.DEFAULT_DEBOUNCE_MS);
    }

    fetchSuggestions(query) {
        const { house, street } = parseHouseStreetFrom(query);

        if (!street || street.length < 3) {
            this.clearList();
            return;
        }

        if (this.abortController) this.abortController.abort();
        this.abortController = new AbortController();

        const hostname = window.location.hostname || "";
        const apiEndPoint = hostname.includes("mivoter.org")
            ? "https://address.mivoter.org"
            : "/api/address-suggest";

        const fetchPromise = fetch(`${apiEndPoint}?street=${encodeURIComponent(street)}&num=${house}&max=5`, {
            signal: this.abortController.signal
        }).then(res => res.json());

        if (this.constructor.WAIT_FOR_FETCH) this.input.disabled = true;

        const timeoutId = setTimeout(() => {
            if (this.abortController) this.abortController.abort();
        }, this.constructor.FETCH_TIMEOUT_MS);

        Promise.race([fetchPromise, this.abortPromise()])
            .then(data => {
                clearTimeout(timeoutId);
                this.input.disabled = false;

                const suggestions = (data.rows || []).map(r => ({
                    label: `${r.num} ${r.street}, ${r.cityname || r.name}, ${r.zipcode}`,
                    raw: r
                }));
                this.renderList(suggestions, data.errorCode);
            })
            .catch(err => {
                clearTimeout(timeoutId);
                this.input.disabled = false;
                if (err.name !== 'AbortError') {
                    console.error('API error:', err);
                    this.clearList();
                }
            });
    }

    abortPromise() {
        return new Promise((_, reject) => {
            this.abortController.signal.addEventListener('abort', () => {
                reject(new DOMException('Aborted', 'AbortError'));
            });
        });
    }

    renderList(suggestions, errorCode) {
        this.results = suggestions;
        this.list.innerHTML = '';
        this.list.hidden = suggestions.length === 0;

        suggestions.forEach((s, i) => {
            const li = document.createElement('li');
            li.innerHTML = s.label || s.address || s;
            li.dataset.index = i;
            this.list.appendChild(li);
        });

        if (errorCode === '2') {
            const li = document.createElement('li');
            li.innerHTML = '<div class="center"><i>(Too many results; keep typing.)</i></div>';
            li.dataset.index = suggestions.length;
            this.list.appendChild(li);
        }

        this.items = this.shadowRoot.querySelectorAll('li');
    }

    clearList() {
        this.list.innerHTML = '';
        this.list.hidden = true;
        this.results = [];
    }

    onClick(e) {
        if (e.target.tagName === 'LI') {
            this.selectSuggestion(parseInt(e.target.dataset.index));
        }
    }

    onKeyDown(e) {
        const max = this.results.length - 1;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.selectedIndex = Math.min(this.selectedIndex + 1, max);
            this.highlightItem();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
            this.highlightItem();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (this.selectedIndex >= 0) {
                this.selectSuggestion(this.selectedIndex);
            } else if (this.results.length === 1) {
                this.selectSuggestion(0);
            }
        }
    }

    highlightItem() {
        if (!this.items) return;
        this.items.forEach(li => li.classList.remove('highlight'));
        const item = this.items[this.selectedIndex];
        if (item) {
            item.classList.add('highlight');
            requestAnimationFrame(() => item.scrollIntoView({ block: 'nearest' }));
        }
    }

    selectSuggestion(index) {
        const selected = this.results[index];
        if (!selected) return;

        let value = selected.label || selected.address || selected;
        if (/^[0-9]+-[0-9]+/.test(value)) {
            value = value.replace(/-[0-9]+/, "");
        }
        this.input.value = value;
        this.clearList();

        this.dispatchEvent(new CustomEvent('address-selected', {
            detail: selected,
            bubbles: true,
            composed: true
        }));
    }
}

customElements.define('address-search', AddressSearch);
