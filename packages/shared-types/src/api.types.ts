import { z } from "zod";
export const CountrySchema=z.enum(["CN","IN","AE","BOTH"]); export type Country=z.infer<typeof CountrySchema>;
export const CodeSchema=z.object({country:z.enum(["CN","IN","AE"]),hsCode:z.string(),descriptionEn:z.string(),descriptionLocal:z.string().nullable(),chapter:z.string(),dutyRate:z.number().nullable(),secondaryRate:z.number().nullable(),requiresLicence:z.boolean(),requiresInspection:z.boolean(),isRestricted:z.boolean(),isProhibited:z.boolean(),importPolicy:z.string().nullable(),inspectionAgency:z.string().nullable(),supervisoryConditions:z.string().nullable(),dataSource:z.string().nullable(),lastUpdated:z.string().nullable(),confidence:z.number().optional()}); export type CodeResult=z.infer<typeof CodeSchema>;
export const SearchResponseSchema=z.object({results:z.array(CodeSchema),total:z.number()}); export type SearchResponse=z.infer<typeof SearchResponseSchema>;
export const DutyRequestSchema=z.object({country:z.enum(["CN","IN","AE"]),hsCode:z.string(),cifUsd:z.number().nonnegative(),landingChargesUsd:z.number().nonnegative().default(0)});
export type DutyRequest=z.infer<typeof DutyRequestSchema>;
export const DutyResponseSchema=z.object({country:z.enum(["CN","IN","AE"]),currency:z.string(),exchangeRate:z.number(),effectiveDate:z.string(),lines:z.array(z.object({label:z.string(),amount:z.number()})),totalDuty:z.number(),landedCost:z.number()}); export type DutyResponse=z.infer<typeof DutyResponseSchema>;
export const ClassifyRequestSchema=z.object({description:z.string().min(2),country:CountrySchema,lang:z.enum(["en","zh-CN","hi"]).default("en")});
export const ErrorLogSchema=z.object({route:z.string().optional(),message:z.string().min(1),stack:z.string().optional()});
