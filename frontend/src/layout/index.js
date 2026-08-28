import React, { useContext, useEffect, useState } from "react";
import clsx from "clsx";
import {
  AppBar,
  Avatar,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
  makeStyles,
  useMediaQuery
} from "@material-ui/core";
import AccountCircle from "@material-ui/icons/AccountCircle";
import Brightness4Icon from "@material-ui/icons/Brightness4";
import Brightness7Icon from "@material-ui/icons/Brightness7";
import ChevronLeftIcon from "@material-ui/icons/ChevronLeft";
import ErrorOutlineIcon from "@material-ui/icons/ErrorOutline";
import LocalHospitalOutlinedIcon from "@material-ui/icons/LocalHospitalOutlined";
import MenuIcon from "@material-ui/icons/Menu";
import WifiIcon from "@material-ui/icons/Wifi";
import { useLocation } from "react-router-dom";

import BackdropLoading from "../components/BackdropLoading";
import NotificationsPopOver from "../components/NotificationsPopOver";
import UserModal from "../components/UserModal";
import { AuthContext } from "../context/Auth/AuthContext";
import { useThemeContext } from "../context/DarkMode";
import { WhatsAppsContext } from "../context/WhatsApp/WhatsAppsContext";
import { i18n } from "../translate/i18n";
import MainListItems from "./MainListItems";
import CommandMenu from "../components/CommandMenu";

const drawerWidth = 272;
const collapsedWidth = 76;

const useStyles = makeStyles(theme => ({
  root: {
    display: "flex",
    height: "100dvh",
    backgroundColor: theme.palette.background.default
  },
  appBar: {
    zIndex: theme.zIndex.drawer + 1,
    minHeight: 72,
    color: theme.palette.text.primary,
    background: theme.palette.background.paper,
    borderBottom: `1px solid ${theme.palette.divider}`,
    boxShadow: "none",
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen
    }),
    [theme.breakpoints.down("sm")]: { minHeight: 64 }
  },
  appBarShift: {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen
    })
  },
  appBarCompact: {
    marginLeft: collapsedWidth,
    width: `calc(100% - ${collapsedWidth}px)`
  },
  toolbar: {
    minHeight: 72,
    padding: "0 24px",
    gap: theme.spacing(1),
    [theme.breakpoints.down("sm")]: { minHeight: 64, padding: "0 10px" }
  },
  menuButton: {
    marginRight: theme.spacing(1),
    color: theme.palette.text.secondary
  },
  menuButtonHidden: { display: "none" },
  title: { flexGrow: 1, minWidth: 0 },
  titlePrimary: {
    display: "block",
    overflow: "hidden",
    color: theme.palette.text.primary,
    fontSize: ".98rem",
    fontWeight: 800,
    lineHeight: 1.2,
    letterSpacing: "-.012em",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  },
  titleSecondary: {
    display: "block",
    marginTop: 3,
    overflow: "hidden",
    color: theme.palette.text.secondary,
    fontSize: ".7rem",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    [theme.breakpoints.down("xs")]: { display: "none" }
  },
  drawerPaper: {
    position: "relative",
    width: drawerWidth,
    overflowX: "hidden",
    whiteSpace: "nowrap",
    color: "#fff",
    backgroundColor: theme.modeTokens.nav,
    borderRight: "1px solid rgba(255,255,255,.07)",
    boxShadow: "12px 0 34px rgba(4,18,31,.08)",
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen
    })
  },
  drawerPaperClose: {
    width: collapsedWidth,
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen
    })
  },
  drawerHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 72,
    padding: "0 14px 0 18px",
    borderBottom: "1px solid rgba(255,255,255,.08)"
  },
  brand: { display: "flex", minWidth: 0, alignItems: "center", gap: 10 },
  brandIcon: {
    width: 38,
    height: 38,
    flexShrink: 0,
    color: "#fff",
    background: "linear-gradient(145deg, #36bfae 0%, #3978e6 100%)",
    boxShadow: "0 8px 20px rgba(0,0,0,.2)"
  },
  brandText: { minWidth: 0, lineHeight: 1.05 },
  brandName: { color: "#fff", fontWeight: 800, letterSpacing: "-.025em" },
  brandCaption: {
    display: "block",
    marginTop: 3,
    color: "rgba(220,235,246,.62)",
    fontSize: ".62rem",
    fontWeight: 750,
    letterSpacing: ".1em",
    textTransform: "uppercase"
  },
  drawerToggle: { color: "rgba(235,246,255,.74)" },
  profilePanel: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.25),
    margin: theme.spacing(2, 1.5, 1),
    padding: theme.spacing(1.25),
    color: "#fff",
    backgroundColor: "rgba(255,255,255,.055)",
    border: "1px solid rgba(255,255,255,.07)",
    borderRadius: 12
  },
  profilePanelCompact: {
    justifyContent: "center",
    margin: theme.spacing(2, 1, 1),
    padding: theme.spacing(1)
  },
  profileAvatar: {
    width: 38,
    height: 38,
    flexShrink: 0,
    color: "#fff",
    fontSize: ".78rem",
    fontWeight: 800,
    background: "linear-gradient(145deg, #0c7c72 0%, #3978e6 100%)"
  },
  profileName: {
    maxWidth: 160,
    overflow: "hidden",
    fontSize: ".84rem",
    fontWeight: 750,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  },
  profileCaption: { color: "rgba(220,235,246,.6)", fontSize: ".68rem" },
  navDivider: { backgroundColor: "rgba(255,255,255,.08)" },
  content: {
    display: "flex",
    flex: 1,
    flexDirection: "column",
    minWidth: 0,
    minHeight: 0,
    paddingTop: 72,
    overflow: "auto",
    backgroundColor: theme.palette.background.default,
    [theme.breakpoints.down("sm")]: { paddingTop: 64 }
  },
  connectionChip: {
    height: 30,
    marginRight: theme.spacing(0.5),
    color: theme.palette.text.secondary,
    background: theme.modeTokens.surfaceMuted,
    borderColor: theme.palette.divider,
    "& .MuiChip-icon": { color: "inherit" },
    [theme.breakpoints.down("xs")]: { display: "none" }
  },
  iconButton: { color: theme.palette.text.secondary },
  headerUserName: {
    maxWidth: 180,
    marginLeft: theme.spacing(0.5),
    overflow: "hidden",
    color: theme.palette.text.secondary,
    fontSize: ".76rem",
    fontWeight: 700,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    [theme.breakpoints.down("sm")]: { display: "none" }
  }
}));

const getRouteDetails = pathname =>
  [
    ["/tickets", "Atendimentos", "Conversas e histórico em tempo real"],
    ["/connections", "Canais", "Saúde das conexões do WhatsApp"],
    ["/contacts", "Contatos", "Base de pacientes e clientes"],
    [
      "/quickanswers",
      "Respostas rápidas",
      "Conteúdo padronizado para a equipe"
    ],
    ["/quark-dashboard", "Automação Quark", "Agendamentos, avisos e operação"],
    ["/quark-clinic", "Quark Clinic", "Acesso integrado à agenda clínica"],
    [
      "/daily-reports",
      "Relatórios diários",
      "Acompanhamento e prestação de contas"
    ],
    ["/users", "Equipe", "Usuários e permissões"],
    ["/queues", "Setores", "Organização das filas de atendimento"],
    ["/settings", "Configurações", "Preferências da operação"]
  ].find(([path]) => pathname.toLowerCase().startsWith(path)) || [
    "/",
    "Visão geral",
    "Panorama da operação de atendimento"
  ];

const LoggedInLayout = ({ children }) => {
  const classes = useStyles();
  const location = useLocation();
  const { handleLogout, loading, user } = useContext(AuthContext);
  const { whatsApps } = useContext(WhatsAppsContext);
  const { darkMode, toggleTheme } = useThemeContext();
  const isMobile = useMediaQuery(theme => theme.breakpoints.down("sm"));
  const isNotebook = useMediaQuery(theme => theme.breakpoints.down("md"));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const routeDetails = getRouteDetails(location.pathname);
  const connectedChannels = whatsApps.filter(
    item => item.status === "CONNECTED"
  ).length;
  const userInitials = (user?.name || "Usuário")
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part.charAt(0))
    .join("")
    .toUpperCase();

  useEffect(() => setDrawerOpen(!isNotebook), [isNotebook]);

  const closeAccountMenu = () => setAnchorEl(null);
  const drawerClose = () => isMobile && setDrawerOpen(false);

  if (loading) return <BackdropLoading />;

  return (
    <div className={classes.root}>
      <Drawer
        variant={isMobile ? "temporary" : "permanent"}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        classes={{
          paper: clsx(classes.drawerPaper, {
            [classes.drawerPaperClose]: !drawerOpen && !isMobile
          })
        }}
        PaperProps={{ style: { position: isMobile ? "fixed" : "relative" } }}
      >
        <div className={classes.drawerHeader}>
          <div className={classes.brand}>
            <Avatar className={classes.brandIcon}>
              <LocalHospitalOutlinedIcon fontSize="small" />
            </Avatar>
            {drawerOpen && (
              <div className={classes.brandText}>
                <Typography variant="subtitle1" className={classes.brandName}>
                  SquadChat
                </Typography>
                <span className={classes.brandCaption}>Essencial Saúde</span>
              </div>
            )}
          </div>
          {drawerOpen && (
            <IconButton
              aria-label="Recolher navegação"
              className={classes.drawerToggle}
              onClick={() => setDrawerOpen(false)}
            >
              <ChevronLeftIcon />
            </IconButton>
          )}
        </div>
        <div
          className={clsx(classes.profilePanel, {
            [classes.profilePanelCompact]: !drawerOpen
          })}
        >
          <Avatar className={classes.profileAvatar}>{userInitials}</Avatar>
          {drawerOpen && (
            <div>
              <div className={classes.profileName}>
                {user?.name || "Usuário"}
              </div>
              <div className={classes.profileCaption}>
                Atendimento integrado
              </div>
            </div>
          )}
        </div>
        <List component="div" disablePadding>
          <MainListItems drawerClose={drawerClose} collapsed={!drawerOpen} />
        </List>
        <Divider className={classes.navDivider} />
      </Drawer>

      <UserModal
        open={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        userId={user?.id}
      />

      <AppBar
        position="absolute"
        className={clsx(classes.appBar, {
          [classes.appBarShift]: drawerOpen && !isMobile,
          [classes.appBarCompact]: !drawerOpen && !isMobile
        })}
      >
        <Toolbar className={classes.toolbar}>
          <IconButton
            edge="start"
            aria-label="Abrir navegação"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(value => !value)}
            className={clsx(classes.menuButton, {
              [classes.menuButtonHidden]: drawerOpen && !isMobile
            })}
          >
            <MenuIcon />
          </IconButton>
          <div className={classes.title}>
            <span className={classes.titlePrimary}>{routeDetails[1]}</span>
            <span className={classes.titleSecondary}>
              Essencial Saúde · {routeDetails[2]}
            </span>
          </div>
          <CommandMenu />
          <Chip
            size="small"
            variant="outlined"
            className={classes.connectionChip}
            icon={connectedChannels ? <WifiIcon /> : <ErrorOutlineIcon />}
            label={
              whatsApps.length
                ? `${connectedChannels}/${whatsApps.length} online`
                : "Sem canais"
            }
          />
          <Tooltip title={darkMode ? "Usar tema claro" : "Usar tema escuro"}>
            <IconButton
              aria-label={darkMode ? "Ativar tema claro" : "Ativar tema escuro"}
              onClick={toggleTheme}
              className={classes.iconButton}
            >
              {darkMode ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
          </Tooltip>
          {user.id && <NotificationsPopOver className={classes.iconButton} />}
          <span className={classes.headerUserName}>{user?.name}</span>
          <IconButton
            aria-label="Menu da conta"
            aria-controls="menu-appbar"
            aria-haspopup="true"
            onClick={event => setAnchorEl(event.currentTarget)}
            className={classes.iconButton}
          >
            <AccountCircle />
          </IconButton>
          <Menu
            id="menu-appbar"
            anchorEl={anchorEl}
            getContentAnchorEl={null}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            open={Boolean(anchorEl)}
            onClose={closeAccountMenu}
          >
            <MenuItem
              onClick={() => {
                setUserModalOpen(true);
                closeAccountMenu();
              }}
            >
              {i18n.t("mainDrawer.appBar.user.profile")}
            </MenuItem>
            <MenuItem
              onClick={() => {
                closeAccountMenu();
                handleLogout();
              }}
            >
              {i18n.t("mainDrawer.appBar.user.logout")}
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <main className={classes.content}>{children || null}</main>
    </div>
  );
};

export default LoggedInLayout;
