class AddressSearch extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.selectedIndex = -1;
        this.results = [];

        this.shadowRoot.innerHTML = `
      <style>
        .container {
          position: relative;
          width: 100%;
        }
        .input-wrapper {
          display: flex;
          align-items: center;
          position: relative;
          gap: 5px;
        }
        input {
          flex: 1;
          width: 100%;
          box-sizing: border-box;
          padding: 10px 36px 10px 10px;
        }
        button.action {
          width: 30px;
          padding: 10px 0;
          margin: 0;
          text-align: center;
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
          max-height: 200px;
          overflow-y: auto;
          z-index: 1000;
        }
        li {
          padding: 10px;
          cursor: pointer;
        }
        li.highlight {
          background-color: #f0f0f0;
        }
      </style>
      <div class="container">
        <div class="input-wrapper">
            <input type="text" placeholder="Search address..." />
            <button class="action" type="button" title="Clear or custom action">✖</button>
        </div>
        <ul hidden></ul>
      </div>
    `;
    }

    connectedCallback() {
        this.input = this.shadowRoot.querySelector('input');
        this.list = this.shadowRoot.querySelector('ul');

        this.input.addEventListener('input', this.onInput.bind(this));
        this.input.addEventListener('keydown', this.onKeyDown.bind(this));
        this.list.addEventListener('click', this.onClick.bind(this));
    }

    onInput(e) {
        const value = this.input.value.trim();
        this.selectedIndex = -1;

        if (value.length < 3) {
            this.clearList();
            return;
        }

        clearTimeout(this.debounceTimeout);
        this.debounceTimeout = setTimeout(() => {
            this.fetchSuggestions(value);
        }, 300);
    }

    extractStreetAndNumber(input) {
        const match = input.match(/^(\d+)\s+(.+)$/);
        if (!match) return { num: '', street: input };
        return { num: match[1], street: match[2] };
    }

    fetchSuggestions(query) {
        const { num, street } = this.extractStreetAndNumber(query);

        if (!num || !street) {
            this.clearList();
            return;
        }

        // Cancel previous request
        if (this.abortController) {
            this.abortController.abort();
        }

        this.abortController = new AbortController();
 
        var hostname    = window.location.hostname ?? "";
        var apiEndPoint = hostname.includes("mivoter.org")
           ? "https://address.mivoter.org"
           : "/api/address-suggest";
        fetch(`${apiEndPoint}?street=${encodeURIComponent(street)}&num=${num}`, {
            signal: this.abortController.signal
        })
            .then(res => res.json())
            .then(data => {
                const suggestions = (data.rows || []).map(r => ({
                    label: r.num + " " + toTitleCase(r.street) + ", " + toTitleCase(r.name) + `, ${r.zipcode}`,
                    raw: r
                }));
                this.renderList(suggestions);
            })
            .catch(err => {
                console.error('API error:', err);
                if (err.name !== 'AbortError') {
                    console.error('API error:', err);
                    this.clearList();
                }
            });
    }

    renderList(suggestions) {
        this.results = suggestions;
        this.list.innerHTML = '';
        this.list.hidden = suggestions.length === 0;

        suggestions.forEach((s, i) => {
            const li = document.createElement('li');
            li.textContent = s.label || s.address || s;
            li.dataset.index = i;
            this.list.appendChild(li);
        });
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
        } else if (e.key === 'Enter' && this.selectedIndex >= 0) {
            e.preventDefault();
            this.selectSuggestion(this.selectedIndex);
        }
    }

    highlightItem() {
        const items = this.shadowRoot.querySelectorAll('li');
        items.forEach((li) => li.classList.remove('highlight'));
        if (items[this.selectedIndex]) {
            items[this.selectedIndex].classList.add('highlight');
            items[this.selectedIndex].scrollIntoView({ block: 'nearest' });
        }
    }

    selectSuggestion(index) {
        const selected = this.results[index];
        if (!selected) return;

        const value = selected.label || selected.address || selected;
        this.input.value = value;
        this.clearList();

        this.dispatchEvent(
            new CustomEvent('address-selected', {
                detail: selected,
                bubbles: true,
                composed: true,
            })
        );
    }
}

function toTitleCase(str) {
    return str.replace(/\w\S*/g, function(txt){
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

customElements.define('address-search', AddressSearch);
