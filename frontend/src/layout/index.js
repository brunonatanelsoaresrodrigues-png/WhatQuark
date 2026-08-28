import React, { useState, useContext, useEffect } from "react";
import clsx from "clsx";
import {
  makeStyles,
  useMediaQuery,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  MenuItem,
  IconButton,
  Menu,
  Switch,
  Avatar
} from "@material-ui/core";
import MenuIcon from "@material-ui/icons/Menu";
import ChevronLeftIcon from "@material-ui/icons/ChevronLeft";
import AccountCircle from "@material-ui/icons/AccountCircle";
import Brightness4Icon from "@material-ui/icons/Brightness4";
import LocalHospitalOutlinedIcon from "@material-ui/icons/LocalHospitalOutlined";

import MainListItems from "./MainListItems";
import NotificationsPopOver from "../components/NotificationsPopOver";
import UserModal from "../components/UserModal";
import { AuthContext } from "../context/Auth/AuthContext";
import BackdropLoading from "../components/BackdropLoading";
import { i18n } from "../translate/i18n";
import { useThemeContext } from "../context/DarkMode";

const drawerWidth = 252;

const useStyles = makeStyles(theme => ({
  root: {
    display: "flex",
    height: "100dvh",
    backgroundColor: theme.palette.background.default,
    [theme.breakpoints.down("sm")]: {
      height: "100dvh"
    }
  },
  toolbar: {
    padding: "0 20px",
    minHeight: 64,
    [theme.breakpoints.down("sm")]: { padding: "0 8px" }
  },
  toolbarIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 10px 0 14px",
    minHeight: 64,
    color: "#fff",
    background: "linear-gradient(135deg, #005b53 0%, #08766c 100%)"
  },
  brand: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.2)
  },
  brandIcon: {
    width: 36,
    height: 36,
    color: "#08766c",
    backgroundColor: "#e7f7f3"
  },
  brandText: {
    minWidth: 0,
    lineHeight: 1.05
  },
  brandName: {
    color: "#fff",
    fontWeight: 800,
    letterSpacing: "-0.02em"
  },
  brandCaption: {
    display: "block",
    marginTop: 2,
    color: "rgba(255,255,255,.72)",
    fontSize: "0.65rem",
    fontWeight: 700,
    letterSpacing: ".08em",
    textTransform: "uppercase"
  },
  closeDrawerButton: {
    color: "#fff"
  },
  appBar: {
    zIndex: theme.zIndex.drawer + 1,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen
    }),
    minHeight: 64,
    color: "#fff",
    background: "linear-gradient(90deg, #006158 0%, #08766c 65%, #0a8175 100%)",
    boxShadow: "0 3px 18px rgba(0, 61, 55, .18)"
  },
  appBarShift: {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen
    })
  },
  menuButton: {
    marginRight: 18,
    color: "#fff",
    [theme.breakpoints.down("sm")]: { marginRight: 4 }
  },
  menuButtonHidden: {
    display: "none"
  },
  title: {
    flexGrow: 1,
    minWidth: 0,
    color: "#fff"
  },
  titlePrimary: {
    display: "block",
    fontSize: ".9rem",
    lineHeight: 1.2,
    fontWeight: 800,
    letterSpacing: ".04em",
    textTransform: "uppercase",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  },
  titleSecondary: {
    display: "block",
    marginTop: 2,
    color: "rgba(255,255,255,.72)",
    fontSize: ".69rem",
    [theme.breakpoints.down("xs")]: { display: "none" }
  },
  drawerPaper: {
    position: "relative",
    whiteSpace: "nowrap",
    width: drawerWidth,
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen
    }),
    backgroundColor: theme.palette.background.paper,
    borderRight: `1px solid ${theme.palette.divider}`,
    boxShadow:
      theme.palette.type === "dark"
        ? "8px 0 28px rgba(0,0,0,.14)"
        : "8px 0 28px rgba(4,77,69,.05)"
  },
  drawerPaperClose: {
    overflowX: "hidden",
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen
    }),
    width: theme.spacing(7),
    [theme.breakpoints.up("sm")]: {
      width: theme.spacing(9)
    }
  },
  appBarSpacer: {
    minHeight: 64
  },
  content: {
    display: "flex",
    flexDirection: "column",
    paddingTop: 64,
    minWidth: 0,
    minHeight: 0,
    flex: 1,
    overflow: "auto",
    backgroundColor: theme.palette.background.default
  },
  container: {
    paddingTop: theme.spacing(4),
    paddingBottom: theme.spacing(4)
  },
  paper: {
    padding: theme.spacing(2),
    display: "flex",
    overflow: "auto",
    flexDirection: "column"
  },
  switch: {
    transform: "scale(0.8)"
  },
  iconButton: {
    color: "#fff"
  },
  themeSwitchContainer: {
    display: "flex",
    alignItems: "center"
  },
  themeIcon: {
    color: "rgba(255,255,255,.84)",
    [theme.breakpoints.down("sm")]: { display: "none" }
  },
  profilePanel: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.25),
    margin: theme.spacing(1.5),
    padding: theme.spacing(1.4),
    borderRadius: 10,
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.type === "dark" ? "#203532" : "#edf7f5",
    border: `1px solid ${theme.palette.divider}`
  },
  profilePanelCompact: {
    justifyContent: "center",
    margin: theme.spacing(1),
    padding: theme.spacing(1)
  },
  profileAvatar: {
    width: 38,
    height: 38,
    fontSize: ".82rem",
    fontWeight: 800,
    color: "#fff",
    background: "linear-gradient(135deg, #08766c 0%, #37b9a6 100%)"
  },
  profileName: {
    maxWidth: 156,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontWeight: 800
  },
  profileCaption: {
    color: theme.palette.text.secondary,
    fontSize: ".7rem"
  },
  headerUserName: {
    maxWidth: 220,
    marginLeft: theme.spacing(1),
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "rgba(255,255,255,.9)",
    fontSize: ".76rem",
    fontWeight: 800,
    textTransform: "uppercase",
    [theme.breakpoints.down("sm")]: { display: "none" }
  }
}));

const LoggedInLayout = ({ children }) => {
  const classes = useStyles();
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { handleLogout, loading } = useContext(AuthContext);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isMobile = useMediaQuery(theme => theme.breakpoints.down("sm"));
  const drawerVariant = isMobile ? "temporary" : "permanent";
  const { user } = useContext(AuthContext);
  const { darkMode, toggleTheme } = useThemeContext();
  const userInitials = (user?.name || "Usuário")
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part.charAt(0))
    .join("")
    .toUpperCase();

  useEffect(() => {
    setDrawerOpen(!isMobile);
  }, [isMobile]);

  const handleMenu = event => {
    setAnchorEl(event.currentTarget);
    setMenuOpen(true);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setMenuOpen(false);
  };

  const handleOpenUserModal = () => {
    setUserModalOpen(true);
    handleCloseMenu();
  };

  const handleClickLogout = () => {
    handleCloseMenu();
    handleLogout();
  };

  const drawerClose = () => {
    if (isMobile) {
      setDrawerOpen(false);
    }
  };

  if (loading) {
    return <BackdropLoading />;
  }

  return (
    <div className={classes.root}>
      <Drawer
        variant={drawerVariant}
        className={
          isMobile
            ? undefined
            : drawerOpen
            ? classes.drawerPaper
            : classes.drawerPaperClose
        }
        classes={{
          paper: clsx(
            classes.drawerPaper,
            !drawerOpen && classes.drawerPaperClose
          )
        }}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ style: { position: isMobile ? "fixed" : "relative" } }}
      >
        <div className={classes.toolbarIcon}>
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
          <IconButton
            aria-label="Fechar navegação"
            className={classes.closeDrawerButton}
            onClick={() => setDrawerOpen(!drawerOpen)}
          >
            <ChevronLeftIcon />
          </IconButton>
        </div>
        <Divider />
        <div
          className={clsx(
            classes.profilePanel,
            !drawerOpen && classes.profilePanelCompact
          )}
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
        <List>
          <MainListItems drawerClose={drawerClose} />
        </List>
        <Divider />
      </Drawer>
      <UserModal
        open={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        userId={user?.id}
      />
      <AppBar
        position="absolute"
        className={clsx(
          classes.appBar,
          drawerOpen && !isMobile && classes.appBarShift
        )}
      >
        <Toolbar variant="dense" className={classes.toolbar}>
          <IconButton
            edge="start"
            aria-label="Abrir navegação"
            onClick={() => setDrawerOpen(!drawerOpen)}
            className={clsx(
              classes.menuButton,
              drawerOpen && !isMobile && classes.menuButtonHidden
            )}
          >
            <MenuIcon />
          </IconButton>
          <div className={classes.title}>
            <span className={classes.titlePrimary}>Essencial Saúde</span>
            <span className={classes.titleSecondary}>
              Atendimento integrado ao QuarkClinic
            </span>
          </div>

          <div className={classes.themeSwitchContainer}>
            <Brightness4Icon className={classes.themeIcon} />
            <Switch
              inputProps={{ "aria-label": "Ativar tema escuro" }}
              checked={darkMode}
              onChange={toggleTheme}
              color="default"
              className={classes.switch}
            />
          </div>

          {user.id && <NotificationsPopOver className={classes.iconButton} />}

          <span className={classes.headerUserName}>{user?.name}</span>

          <div>
            <IconButton
              aria-label="Menu da conta"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleMenu}
              className={classes.iconButton}
            >
              <AccountCircle />
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              getContentAnchorEl={null}
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "right"
              }}
              transformOrigin={{
                vertical: "top",
                horizontal: "right"
              }}
              open={menuOpen}
              onClose={handleCloseMenu}
            >
              <MenuItem onClick={handleOpenUserModal}>
                {i18n.t("mainDrawer.appBar.user.profile")}
              </MenuItem>
              <MenuItem onClick={handleClickLogout}>
                {i18n.t("mainDrawer.appBar.user.logout")}
              </MenuItem>
            </Menu>
          </div>
        </Toolbar>
      </AppBar>
      <main className={classes.content}>{children ? children : null}</main>
    </div>
  );
};

export default LoggedInLayout;
