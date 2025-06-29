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
        li {
          padding: 0.2em; 10px 0 10px;
          cursor: pointer;
        }
        li.highlight {
          background-color: #f0f0f0;
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

        this.input.addEventListener('input', this.onInput.bind(this));
        this.input.addEventListener('keydown', this.onKeyDown.bind(this));
        this.list.addEventListener('click', this.onClick.bind(this));

        // button for clearing input
        this.actionButton.addEventListener('click', () => {
            this.input.value = '';
            this.clearList();
            this.input.focus();
        });
    }

    onInput(e) {
        const value = this.input.value.trim();
        this.selectedIndex = -1;

        if (value.length < 3) {
            this.clearList();
            return;
        }

        // Call fetch after debounce
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

    extractHouseStreetCityFrom (text) {
       var pos = this.scanWhile(text,  0,   this.isSpace);
       pos     = this.scanWhile(text,  pos, this.isDigit);
       var house = text.substr(0, pos).trim();

       var streetStart = pos;
       pos = this.scanWhile(text, streetStart, this.notComma);
       var street = text.substr(streetStart, pos-streetStart).trim();
 
       var city = (pos < text.length-1 ? text.substr(pos+1) : "").trim();

       return { num: house, street: street, city: city};
    }

    scanWhile(text, pos, callback) {
       while (true) {
          if (pos >= text.length)     return text.length;
          if (! callback(text, pos))  return pos;
          ++pos;
       }
    }

    isDigit(text, pos) {
       const code = text.charCodeAt(pos);
       return (code >= 48  &&  code <= 57);
    }

    isSpace(text, pos)  { return text.charAt(pos) == ' '; }

    notComma(text, pos) { return text.charAt(pos) != ','; }

    fetchSuggestions(query) {
        const {num, street, city} = this.extractHouseStreetCityFrom(query);

        if (!street  ||  street.length < 3) {
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
        fetch(`${apiEndPoint}?street=${encodeURIComponent(street)}&num=${num}&city=${city}&max=4`, {
            signal: this.abortController.signal
        })
            .then(res => res.json())
            .then(data => {
                const suggestions = (data.rows || []).map(r => ({
                    label: `${r.num} ${r.street}, ${r.name}, ${r.zipcode}`,
                    raw: r
                }));
                this.renderList(suggestions, data.errorCode);
            })
            .catch(err => {
                console.error('API error:', err);
                if (err.name !== 'AbortError') {
                    console.error('API error:', err);
                    this.clearList();
                }
            });
    }

    renderList(suggestions, errorCode) {
        this.results = suggestions;
        this.list.innerHTML = '';
        this.list.hidden = suggestions.length === 0;

        suggestions.forEach((s, i) => {
            this.addToResultsList(s.label || s.address || s, i);
        });

        if (errorCode == '2')
           this.addToResultsList('<center><i>(Too many results; keep typing.)</i></center>', suggestions.length);
    }

    addToResultsList (text, rowNumber) {
       const li = document.createElement('li');
       li.textContent = text;
       li.dataset.index = rowNumber;
       this.list.appendChild(li);
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

customElements.define('address-search', AddressSearch);
