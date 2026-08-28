import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter, Route, Switch } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import { ThemeProvider } from "../../src/context/DarkMode";
import { AuthContext } from "../../src/context/Auth/AuthContext";
import { WhatsAppsContext } from "../../src/context/WhatsApp/WhatsAppsContext";
import Layout from "../../src/layout";
import Tickets from "../../src/pages/Tickets";
import Dashboard from "../../src/pages/Dashboard";
import Contacts from "../../src/pages/Contacts";
import Connections from "../../src/pages/Connections";
import QuickAnswers from "../../src/pages/QuickAnswers";
import Users from "../../src/pages/Users";
import Queues from "../../src/pages/Queues";
import Settings from "../../src/pages/Settings";
import DailyReports from "../../src/pages/DailyReports";
import QuarkDashboard from "../../src/pages/QuarkDashboard";
import QuarkClinic from "../../src/pages/QuarkClinic";
import Login from "../../src/pages/Login";
import Signup from "../../src/pages/Signup";
import { user, channels } from "./api";
import "react-toastify/dist/ReactToastify.css";
window.ENV = { VITE_QUARK_CLINIC_URL: "about:blank" };
ReactDOM.render(
  <BrowserRouter>
    <AuthContext.Provider
      value={{
        user,
        loading: false,
        isAuth: true,
        handleLogin() {},
        handleLogout() {}
      }}
    >
      <ThemeProvider>
        <WhatsAppsContext.Provider value={{ whatsApps: channels }}>
          <Switch>
            <Route path="/login" component={Login} />
            <Route path="/signup" component={Signup} />
            <Route>
              <Layout>
                <Switch>
                  <Route exact path="/" component={Dashboard} />
                  <Route path="/tickets/:ticketId?" component={Tickets} />
                  <Route path="/contacts" component={Contacts} />
                  <Route path="/connections" component={Connections} />
                  <Route path="/quickAnswers" component={QuickAnswers} />
                  <Route path="/users" component={Users} />
                  <Route path="/queues" component={Queues} />
                  <Route path="/settings" component={Settings} />
                  <Route path="/daily-reports" component={DailyReports} />
                  <Route path="/quark-dashboard" component={QuarkDashboard} />
                  <Route path="/quark-clinic" component={QuarkClinic} />
                </Switch>
              </Layout>
            </Route>
          </Switch>
          <ToastContainer />
          <pre id="qa-requests" hidden />
        </WhatsAppsContext.Provider>
      </ThemeProvider>
    </AuthContext.Provider>
  </BrowserRouter>,
  document.getElementById("root")
);
