import React from "react";
import { TableCell, TableRow, Typography } from "@material-ui/core";
import SearchIcon from "@material-ui/icons/Search";

export default function TableEmptyState({
  columns = 6,
  title = "Nenhum registro encontrado",
  description = "Revise a busca ou adicione um novo registro para começar."
}) {
  return (
    <TableRow>
      <TableCell
        colSpan={columns}
        align="center"
        style={{ padding: "48px 24px" }}
      >
        <SearchIcon
          color="disabled"
          style={{ fontSize: 32, marginBottom: 8 }}
        />
        <Typography variant="subtitle1">{title}</Typography>
        <Typography
          variant="body2"
          color="textSecondary"
          style={{ marginTop: 4 }}
        >
          {description}
        </Typography>
      </TableCell>
    </TableRow>
  );
}
