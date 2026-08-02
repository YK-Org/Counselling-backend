import prisma from "../../prisma/client";

// Who is allowed to download a stored object.
//
// Storage keys are opaque and unguessable, but that is obscurity, not access
// control: a key seen once — in a URL, a shared screenshot, a previous
// assignment — otherwise worked forever, for any signed-in user. These are
// counselling letters and assignments, so access has to follow the couple.
export type MediaOwner =
  | { scope: "shared" }
  | { scope: "couple"; coupleId: string };

// Keys are `<prefix>/<ulid>.<ext>`. The prefix says which table to consult, so
// an unknown or absent prefix is refused outright rather than searched for.
const prefixOf = (key: string) => key.split("/")[0];

class MediaAccessService {
  private async resolveOwner(key: string): Promise<MediaOwner | null> {
    switch (prefixOf(key)) {
      // The shared library: every counsellor is meant to read these.
      case "resources": {
        const resource = await prisma.resource.findFirst({
          where: { uploads: { array_contains: [{ id: key }] } },
          select: { id: true },
        });
        return resource ? { scope: "shared" } : null;
      }

      case "letters": {
        const couple = await prisma.couple.findFirst({
          where: { letterFileId: key },
          select: { id: true },
        });
        return couple ? { scope: "couple", coupleId: couple.id } : null;
      }

      case "assignments": {
        const assignment = await prisma.assignment.findFirst({
          where: { uploads: { array_contains: [{ id: key }] } },
          select: { couplesId: true },
        });
        return assignment
          ? { scope: "couple", coupleId: assignment.couplesId }
          : null;
      }

      // Profile pictures have their own endpoints with their own rules, and
      // nothing else should be reachable through a media download at all.
      default:
        return null;
    }
  }

  // Every requested key must be permitted. Refusing the whole request rather
  // than filtering means a caller cannot probe which keys exist by watching
  // what comes back.
  async canAccessAll(
    user: { id: string; role: string },
    keys: string[]
  ): Promise<boolean> {
    if (!keys.length) return false;

    for (const key of keys) {
      if (typeof key !== "string" || !key) return false;

      const owner = await this.resolveOwner(key);
      if (!owner) return false;
      if (owner.scope === "shared") continue;

      // Head counsellors oversee every couple; a counsellor only sees their own.
      if (user.role === "headCounsellor") continue;

      const couple = await prisma.couple.findUnique({
        where: { id: owner.coupleId },
        select: { counsellorId: true },
      });
      if (!couple || couple.counsellorId !== user.id) return false;
    }

    return true;
  }
}

export default new MediaAccessService();
