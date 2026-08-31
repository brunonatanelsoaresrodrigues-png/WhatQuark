import { Op } from "sequelize";
import Contact from "../../models/Contact";
import ContactIdentityIssue from "../../models/ContactIdentityIssue";
import ContactQuarkLink from "../../models/ContactQuarkLink";

interface Request {
  status?: string;
  type?: string;
  pageNumber?: string;
  search?: string;
}

const ListIdentityIssuesService = async ({
  status = "OPEN",
  type = "",
  pageNumber = "1",
  search = ""
}: Request) => {
  const limit = 30;
  const offset = (Math.max(1, Number(pageNumber) || 1) - 1) * limit;
  const contactWhere = search
    ? {
        [Op.or]: [
          { name: { [Op.like]: `%${search}%` } },
          { number: { [Op.like]: `%${search.replace(/\D/g, "")}%` } }
        ]
      }
    : undefined;
  const where = {
    ...(status ? { status } : {}),
    ...(type ? { type } : {})
  };
  const { count, rows } = await ContactIdentityIssue.findAndCountAll({
    where,
    include: [
      {
        model: Contact,
        required: true,
        where: contactWhere,
        attributes: ["id", "name", "number", "lid", "cpf", "profilePicUrl"]
      }
    ],
    order: [
      ["severity", "ASC"],
      ["lastSeenAt", "DESC"]
    ],
    limit,
    offset
  });
  const contactIds = Array.from(new Set(rows.map(row => row.contactId)));
  const links = contactIds.length
    ? await ContactQuarkLink.findAll({ where: { contactId: { [Op.in]: contactIds } } })
    : [];
  const linkByContact = new Map(links.map(link => [link.contactId, link]));
  const summaryRows = await ContactIdentityIssue.findAll({
    where: { status: "OPEN" },
    attributes: ["type"]
  });
  const byType = summaryRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.type] = (acc[row.type] || 0) + 1;
    return acc;
  }, {});
  return {
    issues: rows.map(row => ({
      ...row.toJSON(),
      evidence: (() => {
        try {
          return JSON.parse(row.evidence || "{}");
        } catch {
          return {};
        }
      })(),
      quarkLink: linkByContact.get(row.contactId) || null
    })),
    count,
    hasMore: count > offset + rows.length,
    summary: { total: summaryRows.length, byType }
  };
};

export default ListIdentityIssuesService;
