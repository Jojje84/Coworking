// ─────────────────────────────────────────
// Swagger Configuration
// ─────────────────────────────────────────

import swaggerJSDoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Coworking Booking API",
      version: "1.0.0",
      description: "API documentation for the coworking booking platform",
    },
    servers: [
      {
        url: "https://coworking-backend-9ngl.onrender.com",
        description: "Production server",
      },
      {
        url: "http://localhost:5000",
        description: "Local development server",
      },
    ],
    security: [
      {
        bearerAuth: [],
      },
      {
        cookieAuth: [],
      },
    ],
    tags: [
      { name: "Auth", description: "Authentication endpoints" },
      { name: "Rooms", description: "Room management" },
      { name: "Bookings", description: "Booking management" },
      { name: "Users", description: "User profile and admin user management" },
      { name: "Settings", description: "System settings" },
      { name: "Audit Logs", description: "System audit event history" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: process.env.AUTH_COOKIE_NAME || "cowork_token",
        },
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          properties: {
            status: {
              type: "string",
              example: "fail",
            },
            message: {
              type: "string",
              example: "Invalid credentials",
            },
          },
        },
        AuthUser: {
          type: "object",
          properties: {
            id: { type: "string", example: "67cabc1234567890abcdef12" },
            username: { type: "string", example: "maria" },
            email: { type: "string", example: "maria@example.com" },
            role: { type: "string", enum: ["User", "Admin"], example: "User" },
            permissions: {
              type: "object",
              properties: {
                bookingHardDelete: { type: "boolean", example: false },
                userHardDelete: { type: "boolean", example: false },
                manageAdmins: { type: "boolean", example: false },
                manageSettings: { type: "boolean", example: false },
                viewAuditLogs: { type: "boolean", example: false },
              },
            },
          },
        },
        LoginResponse: {
          type: "object",
          properties: {
            token: { type: "string", example: "jwt-token-here" },
            user: {
              $ref: "#/components/schemas/AuthUser",
            },
          },
        },
        RegisterRequest: {
          type: "object",
          required: ["username", "email", "password"],
          properties: {
            username: { type: "string", example: "maria" },
            email: { type: "string", example: "maria@example.com" },
            password: { type: "string", example: "secret123" },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", example: "maria@example.com" },
            password: { type: "string", example: "secret123" },
          },
        },
        Room: {
          type: "object",
          properties: {
            _id: { type: "string", example: "67cabc1234567890abcdef12" },
            name: { type: "string", example: "Conference Room A" },
            capacity: { type: "integer", example: 8 },
            type: {
              type: "string",
              enum: ["workspace", "conference"],
              example: "conference",
            },
            description: { type: "string", example: "Large conference room" },
            imageUrl: {
              type: "string",
              example: "https://example.com/room.jpg",
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        RoomInput: {
          type: "object",
          required: ["name", "capacity", "type"],
          properties: {
            name: { type: "string", example: "Conference Room A" },
            capacity: { type: "integer", example: 8 },
            type: {
              type: "string",
              enum: ["workspace", "conference"],
              example: "conference",
            },
            description: { type: "string", example: "Large conference room" },
            imageUrl: {
              type: "string",
              example: "https://example.com/room.jpg",
            },
          },
        },
        Booking: {
          type: "object",
          properties: {
            _id: { type: "string", example: "67cabc1234567890abcdef12" },
            roomId: {
              oneOf: [
                { type: "string", example: "67cabc1234567890abcdef99" },
                {
                  type: "object",
                  properties: {
                    _id: {
                      type: "string",
                      example: "67cabc1234567890abcdef99",
                    },
                    name: { type: "string", example: "Conference Room A" },
                    capacity: { type: "integer", example: 8 },
                    type: {
                      type: "string",
                      enum: ["workspace", "conference"],
                      example: "conference",
                    },
                  },
                },
              ],
            },
            userId: {
              oneOf: [
                { type: "string", example: "67cabc1234567890abcdef55" },
                {
                  type: "object",
                  properties: {
                    _id: {
                      type: "string",
                      example: "67cabc1234567890abcdef55",
                    },
                    username: { type: "string", example: "maria" },
                    email: { type: "string", example: "maria@example.com" },
                    role: {
                      type: "string",
                      enum: ["User", "Admin"],
                      example: "User",
                    },
                  },
                },
              ],
            },
            startTime: { type: "string", format: "date-time" },
            endTime: { type: "string", format: "date-time" },
            status: {
              type: "string",
              enum: ["active", "cancelled", "completed"],
              example: "active",
            },
            cancelledAt: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        BookingInput: {
          type: "object",
          required: ["roomId", "startTime", "endTime"],
          properties: {
            roomId: { type: "string", example: "67cabc1234567890abcdef99" },
            startTime: {
              type: "string",
              format: "date-time",
              example: "2026-03-10T09:00:00.000Z",
            },
            endTime: {
              type: "string",
              format: "date-time",
              example: "2026-03-10T10:00:00.000Z",
            },
          },
        },
        BookingUpdateInput: {
          type: "object",
          description:
            "Users can update their own bookings. Admins can update any booking. Cancel a booking by setting status to cancelled.",
          properties: {
            roomId: {
              type: "string",
              example: "67cabc1234567890abcdef99",
              description: "Change the booked room (owner or admin only)",
            },
            startTime: {
              type: "string",
              format: "date-time",
              example: "2026-03-10T09:00:00.000Z",
            },
            endTime: {
              type: "string",
              format: "date-time",
              example: "2026-03-10T10:00:00.000Z",
            },
            status: {
              type: "string",
              enum: ["active", "cancelled", "completed"],
              example: "cancelled",
            },
          },
        },
        AvailabilityResponse: {
          type: "object",
          properties: {
            available: {
              type: "boolean",
              example: true,
            },
          },
        },
        CalendarBooking: {
          type: "object",
          properties: {
            id: { type: "string", example: "67cabc1234567890abcdef12" },
            roomId: {
              type: "string",
              nullable: true,
              example: "67cabc1234567890abcdef99",
            },
            roomName: { type: "string", example: "Conference Room A" },
            startTime: { type: "string", format: "date-time" },
            endTime: { type: "string", format: "date-time" },
            status: {
              type: "string",
              enum: ["active", "completed"],
              example: "active",
            },
            isMine: { type: "boolean", example: true },
          },
        },
        User: {
          type: "object",
          properties: {
            id: { type: "string", example: "67cabc1234567890abcdef12" },
            username: { type: "string", example: "maria" },
            email: { type: "string", example: "maria@example.com" },
            role: { type: "string", enum: ["User", "Admin"], example: "User" },
            permissions: {
              type: "object",
              properties: {
                bookingHardDelete: { type: "boolean", example: false },
                userHardDelete: { type: "boolean", example: false },
                manageAdmins: { type: "boolean", example: false },
                manageSettings: { type: "boolean", example: false },
                viewAuditLogs: { type: "boolean", example: false },
              },
            },
            isDeleted: { type: "boolean", example: false },
            deletedAt: { type: "string", format: "date-time", nullable: true },
            deleteAfter: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        UserInput: {
          type: "object",
          required: ["username", "email", "password"],
          properties: {
            username: { type: "string", example: "maria" },
            email: { type: "string", example: "maria@example.com" },
            password: { type: "string", example: "secret123" },
            role: { type: "string", enum: ["User", "Admin"], example: "User" },
            bookingHardDelete: { type: "boolean", example: false },
            userHardDelete: { type: "boolean", example: false },
            manageAdmins: { type: "boolean", example: false },
            manageSettings: { type: "boolean", example: false },
            viewAuditLogs: { type: "boolean", example: false },
          },
        },
        UserUpdateInput: {
          type: "object",
          properties: {
            username: { type: "string", example: "maria" },
            email: { type: "string", example: "maria@example.com" },
            password: { type: "string", example: "newsecret123" },
            role: { type: "string", enum: ["User", "Admin"], example: "Admin" },
            bookingHardDelete: { type: "boolean", example: true },
            userHardDelete: { type: "boolean", example: false },
            manageAdmins: { type: "boolean", example: true },
            manageSettings: { type: "boolean", example: true },
            viewAuditLogs: { type: "boolean", example: true },
          },
        },
        UpdateMeInput: {
          type: "object",
          properties: {
            username: { type: "string", example: "Anna Andersson" },
            email: { type: "string", example: "anna@mail.com" },
            currentPassword: { type: "string", example: "oldpassword123" },
            newPassword: { type: "string", example: "newpassword123" },
          },
        },
        DeleteResult: {
          type: "object",
          properties: {
            ok: { type: "boolean", example: true },
          },
        },
        DeleteUserResult: {
          type: "object",
          properties: {
            message: {
              type: "string",
              example:
                "User soft deleted. Future active bookings were cancelled and can be reviewed during grace period.",
            },
            deleteAfter: {
              type: "string",
              format: "date-time",
              example: "2026-03-24T10:00:00.000Z",
            },
          },
        },
        AppSettings: {
          type: "object",
          properties: {
            id: { type: "string", example: "67cabc1234567890abcdef12" },
            allowSelfRegistration: { type: "boolean", example: true },
            maintenanceMode: { type: "boolean", example: false },
            adminAnnouncement: {
              type: "string",
              example: "System maintenance tonight 22:00",
            },
            userAnnouncement: {
              type: "string",
              example: "Welcome! Check new available rooms this week.",
            },
            updatedBy: {
              type: "string",
              nullable: true,
              example: "67cabc1234567890abcdef12",
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        AppSettingsUpdateInput: {
          type: "object",
          properties: {
            allowSelfRegistration: { type: "boolean", example: false },
            maintenanceMode: { type: "boolean", example: true },
            adminAnnouncement: {
              type: "string",
              example: "Maintenance in progress",
            },
            userAnnouncement: {
              type: "string",
              example: "New booking policy is now active",
            },
          },
        },
        AuditLogItem: {
          type: "object",
          properties: {
            id: { type: "string", example: "67cabc1234567890abcdef12" },
            action: { type: "string", example: "user.updated" },
            targetType: { type: "string", example: "user" },
            targetId: { type: "string", example: "67cabc1234567890abcdef55" },
            summary: { type: "string", example: "User maria was updated" },
            metadata: { type: "object" },
            actor: {
              type: "object",
              properties: {
                id: { type: "string", nullable: true },
                username: { type: "string", example: "anna" },
                email: { type: "string", example: "admin@cowork.se" },
                role: { type: "string", example: "Admin" },
              },
            },
            actorRole: { type: "string", example: "Admin" },
            ipAddress: { type: "string", example: "::1" },
            userAgent: { type: "string", example: "Mozilla/5.0" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        AuditLogPage: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: { $ref: "#/components/schemas/AuditLogItem" },
            },
            page: { type: "integer", example: 1 },
            limit: { type: "integer", example: 20 },
            total: { type: "integer", example: 42 },
            totalPages: { type: "integer", example: 3 },
          },
        },
      },
    },
  },
  apis: ["./src/routes/*.js"],
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;
