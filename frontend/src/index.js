import React from "react";
import ReactDOM from "react-dom";

import "./theme/base.css";
import App from "./App";

// O CssBaseline efetivo vive dentro do ThemeProvider (context/DarkMode), que e
// quem conhece o modo e os tokens. Monta-lo aqui aplicaria a baseline padrao do
// Material UI, fora do tema.
ReactDOM.render(<App />, document.getElementById("root"));
