// Vite entry. Pulls together the stylesheets and the waterfall-tools
// wrapper so the page can stay structured around classic-script
// modules in public/js/compare/ that share globals — those load
// separately via <script defer> from index.html.

import './vendor-css/loader.css';
import './css/main.css';
import './waterfall-tools-overrides.js';
