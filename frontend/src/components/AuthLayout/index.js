import React from "react";
import PropTypes from "prop-types";
import { Typography, makeStyles } from "@material-ui/core";
import BrandMark from "../BrandMark";

// Moldura compartilhada por Login e Signup. Antes cada pagina repetia o mesmo
// bloco de estilo e o cadeado padrao do template do Material UI.
const useStyles = makeStyles(theme => ({
  root: {
    position: "relative",
    display: "flex",
    minHeight: "100dvh",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing(3),
    overflow: "hidden",
    background: theme.palette.background.default,
    [theme.breakpoints.down("xs")]: {
      padding: theme.spacing(2)
    }
  },
  // Brilho da marca atras do cartao. Fica no fundo, sem competir com o texto.
  glow: {
    position: "absolute",
    top: "-28vh",
    left: "50%",
    width: "min(760px, 130vw)",
    height: "min(760px, 130vw)",
    transform: "translateX(-50%)",
    pointerEvents: "none",
    background: theme.gradients.glow
  },
  shell: {
    position: "relative",
    width: "100%",
    maxWidth: 420,
    animation: theme.productTokens.animations.arrive
  },
  brand: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    gap: 10,
    marginBottom: theme.spacing(3)
  },
  brandIcon: {
    display: "grid",
    placeItems: "center",
    width: 48,
    height: 48,
    borderRadius: theme.productTokens.radii.md,
    color: theme.productTokens.colors.onBrandLight,
    backgroundImage: theme.gradients.brand,
    boxShadow: theme.productTokens.shadows.raised,
    "& svg": {
      width: 30,
      height: 30
    }
  },
  brandName: {
    fontSize: "1rem",
    fontWeight: 650,
    letterSpacing: "-.025em",
    color: theme.palette.text.primary
  },
  brandCaption: {
    marginTop: 2,
    fontSize: ".75rem",
    color: theme.palette.text.secondary
  },
  card: {
    padding: theme.spacing(4),
    borderRadius: theme.productTokens.radii.lg,
    border: `1px solid ${theme.palette.divider}`,
    background: theme.modeTokens.surfaceRaised,
    boxShadow: theme.productTokens.shadows.raised,
    [theme.breakpoints.down("xs")]: {
      padding: theme.spacing(2.5)
    }
  },
  title: {
    fontSize: "1.3rem",
    fontWeight: 650,
    letterSpacing: "-.025em",
    color: theme.palette.text.primary
  },
  description: {
    marginTop: 6,
    marginBottom: theme.spacing(1),
    fontSize: ".82rem",
    color: theme.palette.text.secondary
  },
  footer: {
    marginTop: theme.spacing(2.5),
    textAlign: "center",
    fontSize: ".82rem",
    color: theme.palette.text.secondary
  }
}));

export default function AuthLayout({
  title,
  description,
  children,
  footer
}) {
  const classes = useStyles();
  return <main className={classes.root}>
      <div className={classes.glow} aria-hidden="true" />
      <div className={classes.shell}>
        <div className={classes.brand}>
          <span className={classes.brandIcon}>
            <BrandMark />
          </span>
          <div style={{
          textAlign: "center"
        }}>
            <Typography component="p" className={classes.brandName}>
              SquadChat
            </Typography>
            <span className={classes.brandCaption}>Essencial Saúde</span>
          </div>
        </div>
        <section className={classes.card}>
          <Typography component="h1" className={classes.title}>
            {title}
          </Typography>
          {description && <Typography component="p" className={classes.description}>
              {description}
            </Typography>}
          {children}
        </section>
        {footer && <div className={classes.footer}>{footer}</div>}
      </div>
    </main>;
}
AuthLayout.propTypes = {
  title: PropTypes.node.isRequired,
  description: PropTypes.node,
  children: PropTypes.node.isRequired,
  footer: PropTypes.node
};
