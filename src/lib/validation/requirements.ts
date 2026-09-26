import { z } from "zod";
import { AMENITIES, PRIORITIES } from "@/lib/matching/types";
import type { RequirementProfile } from "@/lib/matching/types";
import { PUNE_LOCALITIES } from "@/lib/providers/location/places";

const priority = z.enum(PRIORITIES);
const locality = z.enum(PUNE_LOCALITIES);
const geo = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
const destination = z.object({
  placeId: z.string().min(1).max(60),
  label: z.string().min(1).max(120),
  point: geo,
});
const p = <T extends z.ZodTypeAny>(value: T) => z.object({ value, priority });

export const RequirementProfileSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(40),
    avatarUrl: z.string().url().max(500).nullable().optional(),
    work: destination,
    commute: p(z.number().int().min(5).max(180)),
    secondaryDestination: destination.nullable().optional(),
    secondaryCommute: p(z.number().int().min(5).max(180)).nullable().optional(),
    maxRent: p(z.number().int().min(1000).max(500000)),
    preferredRent: p(z.number().int().min(1000).max(500000)).nullable().optional(),
    utilitiesIncluded: p(z.boolean()),
    areas: p(z.object({ preferred: z.array(locality).max(14), acceptable: z.array(locality).max(14) })),
    excludedAreas: p(z.array(locality).max(14)),
    bedrooms: p(z.number().int().min(1).max(6)),
    bathrooms: p(z.number().int().min(1).max(6)),
    lift: p(z.object({ required: z.boolean(), aboveFloor: z.number().int().min(0).max(40) })),
    parking: p(z.enum(["none", "two-wheeler", "car"])),
    furnishing: p(z.array(z.enum(["furnished", "semi-furnished", "unfurnished"])).max(3)),
    petFriendly: p(z.boolean()),
    balcony: p(z.boolean()),
    floor: p(
      z.object({
        min: z.number().int().min(0).max(60).nullable(),
        max: z.number().int().min(0).max(60).nullable(),
      }),
    ),
    amenities: z.array(z.object({ amenity: z.enum(AMENITIES), priority })).max(AMENITIES.length),
    notes: z.string().trim().max(500).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.preferredRent && v.preferredRent.value > v.maxRent.value) {
      ctx.addIssue({ code: "custom", path: ["preferredRent"], message: "Preferred rent can't be above your maximum." });
    }
    const overlap = v.excludedAreas.value.filter((a) => v.areas.value.preferred.includes(a) || v.areas.value.acceptable.includes(a));
    if (overlap.length) {
      ctx.addIssue({ code: "custom", path: ["excludedAreas"], message: `${overlap.join(", ")} can't be both wanted and excluded.` });
    }
    const f = v.floor.value;
    if (f.min != null && f.max != null && f.min > f.max) {
      ctx.addIssue({ code: "custom", path: ["floor"], message: "Minimum floor is above maximum floor." });
    }
  });

export type RequirementProfileInput = z.infer<typeof RequirementProfileSchema>;

/** Compile-time check that the schema output is assignable to the engine type. */
export function toProfile(input: RequirementProfileInput): RequirementProfile {
  return input as RequirementProfile;
}

/** Flatten a profile into requirement_items rows (key, priority, value). */
export function toRequirementItems(profile: RequirementProfile) {
  const items: { key: string; priority: string; value: unknown }[] = [
    { key: "commute", priority: profile.commute.priority, value: { minutes: profile.commute.value, work: profile.work } },
    { key: "budget", priority: profile.maxRent.priority, value: profile.maxRent.value },
    { key: "utilities", priority: profile.utilitiesIncluded.priority, value: profile.utilitiesIncluded.value },
    { key: "areas", priority: profile.areas.priority, value: profile.areas.value },
    { key: "excluded_areas", priority: profile.excludedAreas.priority, value: profile.excludedAreas.value },
    { key: "bedrooms", priority: profile.bedrooms.priority, value: profile.bedrooms.value },
    { key: "bathrooms", priority: profile.bathrooms.priority, value: profile.bathrooms.value },
    { key: "lift", priority: profile.lift.priority, value: profile.lift.value },
    { key: "parking", priority: profile.parking.priority, value: profile.parking.value },
    { key: "furnishing", priority: profile.furnishing.priority, value: profile.furnishing.value },
    { key: "pet_friendly", priority: profile.petFriendly.priority, value: profile.petFriendly.value },
    { key: "balcony", priority: profile.balcony.priority, value: profile.balcony.value },
    { key: "floor", priority: profile.floor.priority, value: profile.floor.value },
  ];
  if (profile.preferredRent) items.push({ key: "preferred_rent", priority: profile.preferredRent.priority, value: profile.preferredRent.value });
  if (profile.secondaryDestination && profile.secondaryCommute) {
    items.push({
      key: "secondary_commute",
      priority: profile.secondaryCommute.priority,
      value: { minutes: profile.secondaryCommute.value, destination: profile.secondaryDestination },
    });
  }
  for (const a of profile.amenities) items.push({ key: `amenity:${a.amenity}`, priority: a.priority, value: true });
  return items;
}
