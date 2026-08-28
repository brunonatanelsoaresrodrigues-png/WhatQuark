const rules = {
  user: {
    static: []
  },

  admin: {
    static: [
      "drawer-admin-items:view",
      "user-modal:editQuarkClinicAccess",
      "tickets-manager:showall",
      "user-modal:editProfile",
      "user-modal:editQueues",
      "ticket-options:deleteTicket",
      "ticket-options:transferWhatsapp",
      "contacts-page:deleteContact"
    ]
  }
};

export default rules;
