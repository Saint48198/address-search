# Address Search

A custom HTML element for searching addresses with Google-like auto-suggest functionality, but backed by your own API.  
Fully encapsulated using Shadow DOM, styled, and easily embeddable on any site.

## Features

- REST API for address searching
- Uses `express` for server
- Fetches data using `node-fetch`
- **Auto-suggest** — fetches suggestions from your backend after user types.
- **Debounce** — configurable delay before requests.
- **Keyboard navigation** — arrow keys and Enter support.
- **Mouse selection** — click to pick.
- **Clear button** — reset input quickly.
- **Custom event** — dispatches `address-selected` with selected data.

## Requirements

- Node.js (v16+ recommended)
- npm

## Installation

```bash
npm install
```

## Example full integration

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Address Search Example</title>
  <script src="address-search.js" type="module"></script> <!-- your compiled component file -->
</head>
<body>
  <h1>Find Your Address</h1>
  <address-search id="addr"></address-search>

  <script>
    const addr = document.getElementById('addr');
    addr.addEventListener('address-selected', e => {
      console.log("User picked:", e.detail);
      // do something like fill another field or trigger a lookup
    });

    // Change debounce globally
    AddressSearch.DEFAULT_DEBOUNCE_MS = 500;
  </script>
</body>
</html>
```

## Author

Scott Daniels  
daniels.scott.r@gmail.com