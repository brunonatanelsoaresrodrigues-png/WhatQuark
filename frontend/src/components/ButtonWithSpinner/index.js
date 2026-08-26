import React from "react";
import clsx from "clsx";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import { CircularProgress, Button } from "@material-ui/core";

const useStyles = makeStyles(theme => ({
	button: {
		position: "relative",
	},

	buttonProgress: {
		color: green[500],
		position: "absolute",
		top: "50%",
		left: "50%",
		marginTop: -12,
		marginLeft: -12,
	},
}));

const ButtonWithSpinner = ({ loading, children, className, ...rest }) => {
	const classes = useStyles();

	return (
		<Button
			className={clsx(classes.button, className)}
			disabled={loading}
			{...rest}
		>
			{children}
			{loading && (
				<CircularProgress size={24} className={classes.buttonProgress} />
			)}
		</Button>
	);
};

export default ButtonWithSpinner;
