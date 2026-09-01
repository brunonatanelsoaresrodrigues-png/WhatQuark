import { Op } from "sequelize";
import ServiceRating from "../../models/ServiceRating";
import User from "../../models/User";

const periodStart = (days: number): Date | undefined =>
  days > 0 ? new Date(Date.now() - days * 86400000) : undefined;

export const GetServiceRatingSummary = async (
  days = 30,
  onlyUserId?: number
) => {
  const start = periodStart(days);
  const users = await User.findAll({
    attributes: ["id", "name"],
    ...(onlyUserId ? { where: { id: onlyUserId } } : {}),
    order: [["name", "ASC"]]
  });
  const ratings = await ServiceRating.findAll({
    where: {
      ...(start ? { createdAt: { [Op.gte]: start } } : {}),
      ...(onlyUserId ? { ratedUserId: onlyUserId } : {})
    },
    attributes: ["id", "ratedUserId", "status", "score", "trigger", "createdAt"]
  });
  const summaries = users.map(user => {
    const rows = ratings.filter(row => row.ratedUserId === user.id);
    const answered = rows.filter(
      row => row.status === "ANSWERED" && row.score !== null
    );
    const average = answered.length
      ? answered.reduce((sum, row) => sum + Number(row.score), 0) /
        answered.length
      : null;
    const distribution = [0, 1, 2, 3, 4, 5].map(
      score => answered.filter(row => row.score === score).length
    );
    const requested = rows.filter(row => row.status !== "FAILED").length;
    return {
      userId: user.id,
      name: user.name,
      average: average === null ? null : Number(average.toFixed(2)),
      points: average === null ? null : Math.round((average / 5) * 100),
      answered: answered.length,
      requested,
      responseRate: requested ? Math.round((answered.length / requested) * 100) : 0,
      distribution,
      eligibleForRanking: answered.length >= 10
    };
  });
  const answeredRows = ratings.filter(
    row => row.status === "ANSWERED" && row.score !== null
  );
  const teamAverage = answeredRows.length
    ? answeredRows.reduce((sum, row) => sum + Number(row.score), 0) /
      answeredRows.length
    : null;
  return {
    periodDays: days,
    team: {
      average: teamAverage === null ? null : Number(teamAverage.toFixed(2)),
      points:
        teamAverage === null ? null : Math.round((teamAverage / 5) * 100),
      answered: answeredRows.length,
      requested: ratings.filter(row => row.status !== "FAILED").length,
      pending: ratings.filter(row => ["PENDING", "SENT"].includes(row.status)).length,
      responseRate: ratings.filter(row => row.status !== "FAILED").length
        ? Math.round(
            (answeredRows.length /
              ratings.filter(row => row.status !== "FAILED").length) *
              100
          )
        : 0
    },
    users: summaries.sort(
      (left, right) =>
        Number(right.average ?? -1) - Number(left.average ?? -1) ||
        right.answered - left.answered
    )
  };
};

export const ListServiceRatings = async ({
  days = 30,
  pageNumber = 1,
  userId
}: {
  days?: number;
  pageNumber?: number;
  userId?: number;
}) => {
  const limit = 30;
  const start = periodStart(days);
  const where = {
    ...(start ? { createdAt: { [Op.gte]: start } } : {}),
    ...(userId ? { ratedUserId: userId } : {})
  };
  const { rows, count } = await ServiceRating.findAndCountAll({
    where,
    include: [{ model: User, as: "ratedUser", attributes: ["id", "name"] }],
    limit,
    offset: limit * (pageNumber - 1),
    order: [["createdAt", "DESC"]]
  });
  return {
    ratings: rows,
    count,
    hasMore: count > pageNumber * limit
  };
};
