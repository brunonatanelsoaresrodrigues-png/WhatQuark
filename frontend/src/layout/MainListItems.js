import React, { useContext, useEffect, useState } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";

import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import ListSubheader from "@material-ui/core/ListSubheader";
import Divider from "@material-ui/core/Divider";
import { Badge } from "@material-ui/core";
import DashboardOutlinedIcon from "@material-ui/icons/DashboardOutlined";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import SyncAltIcon from "@material-ui/icons/SyncAlt";
import SettingsOutlinedIcon from "@material-ui/icons/SettingsOutlined";
import PeopleAltOutlinedIcon from "@material-ui/icons/PeopleAltOutlined";
import ContactPhoneOutlinedIcon from "@material-ui/icons/ContactPhoneOutlined";
import AccountTreeOutlinedIcon from "@material-ui/icons/AccountTreeOutlined";
import QuestionAnswerOutlinedIcon from "@material-ui/icons/QuestionAnswerOutlined";
import AssessmentOutlinedIcon from "@material-ui/icons/AssessmentOutlined";
import LocalHospitalOutlinedIcon from "@material-ui/icons/LocalHospitalOutlined";
import InsertChartOutlinedIcon from "@material-ui/icons/InsertChartOutlined";

import { i18n } from "../translate/i18n";
import { WhatsAppsContext } from "../context/WhatsApp/WhatsAppsContext";
import { AuthContext } from "../context/Auth/AuthContext";
import { Can } from "../components/Can";

const useStyles = makeStyles((theme) => ({
  navigation: {
    padding: theme.spacing(0.5, 1.25, 2),
  },
  item: {
    minHeight: 42,
    margin: theme.spacing(0.35, 0),
    paddingLeft: theme.spacing(1.5),
    borderRadius: 8,
    borderLeft: "3px solid transparent",
    color: theme.palette.text.secondary,
    "& .MuiListItemIcon-root": {
      minWidth: 38,
      color: "inherit",
    },
    "& .MuiListItemText-primary": {
      fontSize: ".86rem",
      fontWeight: 650,
    },
    "&:hover": {
      color: theme.palette.primary.main,
      backgroundColor:
        theme.palette.type === "dark" ? "rgba(54,183,165,.1)" : "#edf8f6",
    },
    "&.Mui-selected": {
      color: theme.palette.primary.dark,
      borderLeftColor: theme.palette.primary.main,
      backgroundColor:
        theme.palette.type === "dark" ? "rgba(54,183,165,.16)" : "#dff3ef",
    },
    "&.Mui-selected:hover": {
      backgroundColor:
        theme.palette.type === "dark" ? "rgba(54,183,165,.2)" : "#d5eee9",
    },
  },
  divider: { margin: theme.spacing(1.25, 0) },
  subheader: {
    color: theme.palette.primary.main,
    fontSize: ".68rem",
    fontWeight: 800,
    lineHeight: "32px",
    letterSpacing: ".08em",
    textTransform: "uppercase",
  },
}));

function ListItemLink(props) {
  const { icon, primary, to, className } = props;
  const location = useLocation();
  const selected =
    to === "/"
      ? location.pathname === "/"
      : location.pathname === to || location.pathname.startsWith(`${to}/`);

  const renderLink = React.useMemo(
    () =>
      React.forwardRef(function ListItemRouterLink(itemProps, ref) {
        return <RouterLink to={to} ref={ref} {...itemProps} />;
      }),
    [to]
  );

  return (
    <li>
      <ListItem
        button
        component={renderLink}
        className={className}
        selected={selected}
      >
        {icon ? <ListItemIcon>{icon}</ListItemIcon> : null}
        <ListItemText primary={primary} />
      </ListItem>
    </li>
  );
}

const MainListItems = (props) => {
  const classes = useStyles();
  const { drawerClose } = props;
  const { whatsApps } = useContext(WhatsAppsContext);
  const { user } = useContext(AuthContext);
  const [connectionWarning, setConnectionWarning] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (whatsApps.length > 0) {
        const offlineWhats = whatsApps.filter((whats) => {
          return (
            whats.status === "qrcode" ||
            whats.status === "PAIRING" ||
            whats.status === "DISCONNECTED" ||
            whats.status === "TIMEOUT" ||
            whats.status === "OPENING"
          );
        });
        if (offlineWhats.length > 0) {
          setConnectionWarning(true);
        } else {
          setConnectionWarning(false);
        }
      }
    }, 2000);
    return () => clearTimeout(delayDebounceFn);
  }, [whatsApps]);

  return (
    <div onClick={drawerClose} className={classes.navigation}>
      <ListItemLink
        to="/"
        primary="Dashboard"
        icon={<DashboardOutlinedIcon />}
        className={classes.item}
      />
      <ListItemLink
        to="/connections"
        primary={i18n.t("mainDrawer.listItems.connections")}
        icon={
          <Badge badgeContent={connectionWarning ? "!" : 0} color="error">
            <SyncAltIcon />
          </Badge>
        }
        className={classes.item}
      />
      <ListItemLink
        to="/tickets"
        primary={i18n.t("mainDrawer.listItems.tickets")}
        icon={<WhatsAppIcon />}
        className={classes.item}
      />

      <ListItemLink
        to="/contacts"
        primary={i18n.t("mainDrawer.listItems.contacts")}
        icon={<ContactPhoneOutlinedIcon />}
        className={classes.item}
      />
      <ListItemLink
        to="/quickAnswers"
        primary={i18n.t("mainDrawer.listItems.quickAnswers")}
        icon={<QuestionAnswerOutlinedIcon />}
        className={classes.item}
      />
      {user.canAccessQuarkClinic && (
        <ListItemLink
          to="/quark-clinic"
          primary="Quark Clinic"
          icon={<LocalHospitalOutlinedIcon />}
          className={classes.item}
        />
      )}
      <Can
        role={user.profile}
        perform="drawer-admin-items:view"
        yes={() => (
          <>
            <Divider className={classes.divider} />
            <ListSubheader className={classes.subheader} disableSticky>
              {i18n.t("mainDrawer.listItems.administration")}
            </ListSubheader>
            <ListItemLink
              to="/quark-dashboard"
              primary="Automação Quark"
              icon={<AssessmentOutlinedIcon />}
              className={classes.item}
            />
            <ListItemLink
              to="/daily-reports"
              primary="Relatórios Diários"
              icon={<InsertChartOutlinedIcon />}
              className={classes.item}
            />
            <ListItemLink
              to="/users"
              primary={i18n.t("mainDrawer.listItems.users")}
              icon={<PeopleAltOutlinedIcon />}
              className={classes.item}
            />
            <ListItemLink
              to="/queues"
              primary={i18n.t("mainDrawer.listItems.queues")}
              icon={<AccountTreeOutlinedIcon />}
              className={classes.item}
            />
            <ListItemLink
              to="/settings"
              primary={i18n.t("mainDrawer.listItems.settings")}
              icon={<SettingsOutlinedIcon />}
              className={classes.item}
            />
          </>
        )}
      />
    </div>
  );
};

export default MainListItems;
