import React, { useContext, useEffect, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import clsx from "clsx";

import { makeStyles } from "@material-ui/core/styles";
import { Chip, IconButton, Tooltip } from "@material-ui/core";
import { HourglassEmpty, MoreVert, PlayArrow, Replay, TimerOff } from "@material-ui/icons";
import { toast } from "react-toastify";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import TicketOptionsMenu from "../TicketOptionsMenu";
import ButtonWithSpinner from "../ButtonWithSpinner";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles(theme => ({
	actionButtons: {
		display: "flex",
		alignItems: "center",
		justifyContent: "flex-end",
		gap: theme.spacing(0.5),
		width: "100%",
		minWidth: 0,
		marginRight: theme.spacing(0.5),
		alignSelf: "center",
		marginLeft: "auto",
		"& > *": {
			flexShrink: 0,
		},
	},
	compactButton: {
		minWidth: 36,
		paddingLeft: theme.spacing(1),
		paddingRight: theme.spacing(1),
		"& .MuiButton-startIcon": {
			marginLeft: 0,
			marginRight: 0,
		},
	},
	resolveButton: {
		flexShrink: 0,
	},
}));

const TicketActionButtons = ({ ticket }) => {
	const classes = useStyles();
	const history = useHistory();
	const [anchorEl, setAnchorEl] = useState(null);
	const [loading, setLoading] = useState(false);
	const [remainingSeconds, setRemainingSeconds] = useState(15 * 60);
	const [actionsWidth, setActionsWidth] = useState(0);
	const actionButtonsRef = useRef(null);
	const ticketOptionsMenuOpen = Boolean(anchorEl);
	const { user } = useContext(AuthContext);
	const compactActions = actionsWidth > 0 && actionsWidth < 520;
	const veryCompactActions = actionsWidth > 0 && actionsWidth < 390;

	useEffect(() => {
		const element = actionButtonsRef.current;
		if (!element) return undefined;

		const updateWidth = () => setActionsWidth(element.getBoundingClientRect().width);
		updateWidth();

		if (typeof ResizeObserver === "undefined") {
			window.addEventListener("resize", updateWidth);
			return () => window.removeEventListener("resize", updateWidth);
		}

		const observer = new ResizeObserver(entries => {
			if (entries[0]) setActionsWidth(entries[0].contentRect.width);
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		if (!ticket.awaitingPatientSince) {
			setRemainingSeconds(15 * 60);
			return undefined;
		}
		const updateRemaining = () => {
			const elapsed = Math.floor(
				(Date.now() - new Date(ticket.awaitingPatientSince).getTime()) / 1000
			);
			setRemainingSeconds(Math.max(0, 15 * 60 - elapsed));
		};
		updateRemaining();
		const timer = setInterval(updateRemaining, 1000);
		return () => clearInterval(timer);
	}, [ticket.awaitingPatientSince]);

	const remainingLabel = `${String(Math.floor(remainingSeconds / 60)).padStart(
		2,
		"0"
	)}:${String(remainingSeconds % 60).padStart(2, "0")}`;

	const handleOpenTicketOptionsMenu = e => {
		setAnchorEl(e.currentTarget);
	};

	const handleCloseTicketOptionsMenu = e => {
		setAnchorEl(null);
	};

	const handleUpdateTicketStatus = async (e, status, userId) => {
		setLoading(true);
		try {
			await api.put(`/tickets/${ticket.id}`, {
				status: status,
				userId: userId || null,
			});

			setLoading(false);
			if (status === "open") {
				history.push(`/tickets/${ticket.id}`);
			} else {
				history.push("/tickets");
			}
		} catch (err) {
			setLoading(false);
			toastError(err);
		}
	};

	const handleWaitingForPatient = async waiting => {
		setLoading(true);
		try {
			await api.post(`/tickets/${ticket.id}/awaiting-patient`, { waiting });
			toast.success(
				waiting
					? i18n.t("messagesList.header.buttons.waitingPatientStarted")
					: i18n.t("messagesList.header.buttons.waitingPatientCancelled")
			);
		} catch (err) {
			toastError(err);
		} finally {
			setLoading(false);
		}
	};

	const handleResumePatientIntake = async () => {
		setLoading(true);
		try {
			await api.post(`/tickets/${ticket.id}/intake/resume`);
			toast.success("Automação retomada e menu enviado ao paciente.");
		} catch (err) {
			toastError(err);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className={classes.actionButtons} ref={actionButtonsRef}>
			{ticket.status === "closed" && ticket.closedByInactivity && (
				<Chip
					size="small"
					variant="outlined"
					color="secondary"
					label={i18n.t("messagesList.header.inactivityResolved")}
				/>
			)}
			{ticket.status === "closed" && (
				<ButtonWithSpinner
					loading={loading}
					startIcon={<Replay />}
					size="small"
					onClick={e => handleUpdateTicketStatus(e, "open", user?.id)}
				>
					{i18n.t("messagesList.header.buttons.reopen")}
				</ButtonWithSpinner>
			)}
			{ticket.status === "open" && (
				<>
					{ticket.intakeStatus === "PAUSED_HUMAN" && (
						<Tooltip title="Retomar bot">
							<span>
								<ButtonWithSpinner
									loading={loading}
									startIcon={<PlayArrow />}
									size="small"
									variant="outlined"
									className={compactActions ? classes.compactButton : undefined}
									aria-label="Retomar bot"
									onClick={handleResumePatientIntake}
								>
									{compactActions ? null : "Retomar bot"}
								</ButtonWithSpinner>
							</span>
						</Tooltip>
					)}
					<Tooltip title={i18n.t("messagesList.header.buttons.waitForPatient")}>
						<span>
							<ButtonWithSpinner
								loading={loading}
								startIcon={
									ticket.awaitingPatientSince ? <TimerOff /> : <HourglassEmpty />
								}
								size="small"
								variant="outlined"
								color={ticket.awaitingPatientSince ? "secondary" : "default"}
								className={veryCompactActions ? classes.compactButton : undefined}
								aria-label={i18n.t("messagesList.header.buttons.waitForPatient")}
								onClick={() =>
									handleWaitingForPatient(!ticket.awaitingPatientSince)
								}
							>
								{veryCompactActions
									? null
									: ticket.awaitingPatientSince
										? i18n.t("messagesList.header.buttons.waitingPatientCountdown", {
											remaining: remainingLabel,
										})
										: i18n.t("messagesList.header.buttons.waitForPatient")}
							</ButtonWithSpinner>
						</span>
					</Tooltip>
					<Tooltip title={i18n.t("messagesList.header.buttons.return")}>
						<span>
							<ButtonWithSpinner
								loading={loading}
								startIcon={<Replay />}
								size="small"
								className={compactActions ? classes.compactButton : undefined}
								aria-label={i18n.t("messagesList.header.buttons.return")}
								onClick={e => handleUpdateTicketStatus(e, "pending", null)}
							>
								{compactActions
									? null
									: i18n.t("messagesList.header.buttons.return")}
							</ButtonWithSpinner>
						</span>
					</Tooltip>
					<ButtonWithSpinner
						loading={loading}
						size="small"
						variant="contained"
						color="primary"
						className={clsx(classes.resolveButton)}
						onClick={e => handleUpdateTicketStatus(e, "closed", user?.id)}
					>
						{i18n.t("messagesList.header.buttons.resolve")}
					</ButtonWithSpinner>
					<IconButton onClick={handleOpenTicketOptionsMenu}>
						<MoreVert />
					</IconButton>
					<TicketOptionsMenu
						ticket={ticket}
						anchorEl={anchorEl}
						menuOpen={ticketOptionsMenuOpen}
						handleClose={handleCloseTicketOptionsMenu}
					/>
				</>
			)}
			{ticket.status === "pending" && (
				<ButtonWithSpinner
					loading={loading}
					size="small"
					variant="contained"
					color="primary"
					onClick={e => handleUpdateTicketStatus(e, "open", user?.id)}
				>
					{i18n.t("messagesList.header.buttons.accept")}
				</ButtonWithSpinner>
			)}
		</div>
	);
};

export default TicketActionButtons;
