import faker from "faker";
import AppError from "../../../errors/AppError";
import CreateUserService from "../../../services/UserServices/CreateUserService";
import DeleteUserService from "../../../services/UserServices/DeleteUserService";
import { disconnect, truncate } from "../../utils/database";

// This suite exercises user deletion without open tickets. Avoid loading the
// WhatsApp transport graph through UpdateTicketService; Jest 26 cannot resolve
// the node:fs/promises import used by the current optional wwebjs dependency.
jest.mock("../../../helpers/UpdateDeletedUserOpenTicketsStatus", () => jest.fn());

describe("User", () => {
  beforeEach(async () => {
    await truncate();
  });

  afterEach(async () => {
    await truncate();
  });

  afterAll(async () => {
    await disconnect();
  });

  it("should be delete a existing user", async () => {
    const { id } = await CreateUserService({
      name: faker.name.findName(),
      email: faker.internet.email(),
      password: faker.internet.password()
    });

    await expect(DeleteUserService(id)).resolves.not.toThrow();
  });

  it("to throw an error if tries to delete a non existing user", async () => {
    await expect(
      DeleteUserService(faker.random.number())
    ).rejects.toBeInstanceOf(AppError);
  });
});
