import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import type { DbService } from "@/db/db.service";
import { AnalyticsService } from "./analytics.service";

interface ChainableQuery {
  from: () => ChainableQuery;
  where: () => ChainableQuery;
  orderBy: () => ChainableQuery;
  limit: () => Promise<unknown[]>;
  innerJoin: () => ChainableQuery;
}

interface MockDbService {
  db: {
    insert: Mock;
    update: Mock;
    select: Mock;
  };
}

describe("AnalyticsService", () => {
  let service: AnalyticsService;
  let mockDb: MockDbService;

  // Helper to create deep mock for Drizzle queries
  const createMockDb = (): MockDbService => {
    const mockQuery = (data: unknown[] = []): ChainableQuery => {
      const chainable: ChainableQuery = {
        from: () => chainable,
        where: () => chainable,
        orderBy: () => chainable,
        limit: () => Promise.resolve(data),
        innerJoin: () => chainable,
      };
      return chainable;
    };

    return {
      db: {
        insert: vi.fn(() => ({
          values: () => ({
            returning: () =>
              Promise.resolve([{ id: "session-1", agentId: "agent-1", connectionId: "conn-1" }]),
          }),
        })),
        update: vi.fn(() => ({
          set: () => ({
            where: () => Promise.resolve(),
          }),
        })),
        select: vi.fn(() => mockQuery([])),
      },
    };
  };

  beforeEach(() => {
    mockDb = createMockDb();
    service = new AnalyticsService(mockDb as unknown as DbService);
  });

  describe("startSession", () => {
    it("should create a new session and return session ID", async () => {
      const result = await service.startSession("agent-1", "conn-1", "127.0.0.1", "Mozilla");

      expect(result).toBe("session-1");
      expect(mockDb.db.insert).toHaveBeenCalled();
    });
  });

  describe("endSession", () => {
    it("should update session status to OFFLINE", async () => {
      await service.endSession("conn-1");

      expect(mockDb.db.update).toHaveBeenCalled();
    });
  });

  describe("updateSessionStatus", () => {
    it("should update session status and lastSeenAt", async () => {
      await service.updateSessionStatus("conn-1", "AWAY");

      expect(mockDb.db.update).toHaveBeenCalled();
    });
  });

  describe("getActiveSession", () => {
    it("should return null when no active session exists", async () => {
      const result = await service.getActiveSession("agent-1");

      expect(result).toBeNull();
    });

    it("should return session when active session exists", async () => {
      const mockSession = { id: "session-1", agentId: "agent-1", status: "ONLINE" };

      // Create a mock that returns the session
      const mockQuery = (): ChainableQuery => {
        const chainable: ChainableQuery = {
          from: () => chainable,
          where: () => chainable,
          orderBy: () => chainable,
          limit: () => Promise.resolve([mockSession]),
          innerJoin: () => chainable,
        };
        return chainable;
      };
      mockDb.db.select = vi.fn(() => mockQuery());

      const result = await service.getActiveSession("agent-1");

      expect(result).toEqual(mockSession);
    });
  });

  describe("updateLastSeen", () => {
    it("should update lastSeenAt timestamp", async () => {
      await service.updateLastSeen("conn-1");

      expect(mockDb.db.update).toHaveBeenCalled();
    });
  });

  // Integration tests for complex methods would require a test database
  // The getAgentPerformance, getOrganizationStats, and getDashboardStats
  // methods involve complex joins and should be tested with integration tests
});
