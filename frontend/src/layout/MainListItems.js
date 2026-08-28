import React, { useContext, useEffect, useState } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import ListSubheader from "@material-ui/core/ListSubheader";
import Divider from "@material-ui/core/Divider";
import { Badge, Tooltip } from "@material-ui/core";
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
const useStyles = makeStyles(theme => ({
  navigation: {
    padding: theme.spacing(1.75, 1, 2)
  },
  compact: {
    "& .MuiListItemText-root, & .MuiListSubheader-root": {
      display: "none"
    },
    "& .MuiListItemIcon-root": {
      minWidth: 0
    },
    "& .MuiListItem-root": {
      justifyContent: "center",
      paddingLeft: 8,
      paddingRight: 8
    }
  },
  item: {
    minHeight: 40,
    margin: theme.spacing(0.35, 0),
    paddingLeft: theme.spacing(1.25),
    borderRadius: 8,
    borderLeft: "0",
    color: theme.modeTokens.navMuted,
    transition: "color 160ms ease, background-color 160ms ease, transform 160ms ease",
    "& .MuiListItemIcon-root": {
      minWidth: 32,
      color: "inherit",
      "& .MuiSvgIcon-root": {
        fontSize: 19
      }
    },
    "& .MuiListItemText-primary": {
      fontSize: ".77rem",
      fontWeight: 450
    },
    "&:hover": {
      color: "#fff",
      backgroundColor: "rgba(255,255,255,.04)"
    },
    "&.Mui-selected": {
      color: "#fff",
      background: theme.modeTokens.navActive,
      boxShadow: "inset 2px 0 #36bfae",
      "& .MuiListItemText-primary": {
        fontWeight: 600
      }
    },
    "&.Mui-selected:hover": {
      background: "#103744"
    }
  },
  divider: {
    margin: theme.spacing(1.25, 0),
    backgroundColor: "rgba(255,255,255,.08)"
  },
  subheader: {
    color: theme.modeTokens.navMuted,
    fontSize: ".6rem",
    fontWeight: 500,
    lineHeight: "32px",
    letterSpacing: ".11em",
    textTransform: "uppercase"
  }
}));
function ListItemLink(props) {
  const {
    icon,
    primary,
    to,
    className
  } = props;
  const location = useLocation();
  const selected = to === "/" ? location.pathname === "/" : location.pathname === to || location.pathname.startsWith(`${to}/`);
  const renderLink = React.useMemo(() => React.forwardRef(function ListItemRouterLink(itemProps, ref) {
    return <RouterLink to={to} ref={ref} {...itemProps} />;
  }), [to]);
  return <Tooltip title={primary} placement="right" enterDelay={600}>
      <ListItem button component={renderLink} className={className} selected={selected} aria-label={primary} aria-current={selected ? "page" : undefined}>
        {icon ? <ListItemIcon>{icon}</ListItemIcon> : null}
        <ListItemText primary={primary} />
      </ListItem>
    </Tooltip>;
}
const MainListItems = props => {
  const classes = useStyles();
  const {
    drawerClose,
    collapsed
  } = props;
  const {
    whatsApps
  } = useContext(WhatsAppsContext);
  const {
    user
  } = useContext(AuthContext);
  const [connectionWarning, setConnectionWarning] = useState(false);
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (whatsApps.length > 0) {
        const offlineWhats = whatsApps.filter(whats => {
          return whats.status === "qrcode" || whats.status === "PAIRING" || whats.status === "DISCONNECTED" || whats.status === "TIMEOUT" || whats.status === "OPENING";
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
  return <nav aria-label="Navegação principal" onClick={drawerClose} className={`${classes.navigation} ${collapsed ? classes.compact : ""}`}>
      <ListItemLink to="/" primary="Visão geral" icon={<DashboardOutlinedIcon />} className={classes.item} />
      <ListItemLink to="/connections" primary={i18n.t("mainDrawer.listItems.connections")} icon={<Badge badgeContent={connectionWarning ? "!" : 0} color="error">
            <SyncAltIcon />
          </Badge>} className={classes.item} />
      <ListItemLink to="/tickets" primary={i18n.t("mainDrawer.listItems.tickets")} icon={<WhatsAppIcon />} className={classes.item} />

      <ListItemLink to="/contacts" primary={i18n.t("mainDrawer.listItems.contacts")} icon={<ContactPhoneOutlinedIcon />} className={classes.item} />
      <ListItemLink to="/quickAnswers" primary={i18n.t("mainDrawer.listItems.quickAnswers")} icon={<QuestionAnswerOutlinedIcon />} className={classes.item} />
      {user.canAccessQuarkClinic && <ListItemLink to="/quark-clinic" primary="Quark Clinic" icon={<LocalHospitalOutlinedIcon />} className={classes.item} />}
      <Can role={user.profile} perform="drawer-admin-items:view" yes={() => <>
            <Divider className={classes.divider} />
            <ListSubheader className={classes.subheader} disableSticky>
              {i18n.t("mainDrawer.listItems.administration")}
            </ListSubheader>
            <ListItemLink to="/quark-dashboard" primary="Automação Quark" icon={<AssessmentOutlinedIcon />} className={classes.item} />
            <ListItemLink to="/daily-reports" primary="Relatórios Diários" icon={<InsertChartOutlinedIcon />} className={classes.item} />
            <ListItemLink to="/users" primary={i18n.t("mainDrawer.listItems.users")} icon={<PeopleAltOutlinedIcon />} className={classes.item} />
            <ListItemLink to="/queues" primary={i18n.t("mainDrawer.listItems.queues")} icon={<AccountTreeOutlinedIcon />} className={classes.item} />
            <ListItemLink to="/settings" primary={i18n.t("mainDrawer.listItems.settings")} icon={<SettingsOutlinedIcon />} className={classes.item} />
          </>} />
    </nav>;
};
export default MainListItems;
