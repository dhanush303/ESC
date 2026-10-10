import type {Dispatch,SetStateAction} from 'react';
export type Category='Plastic'|'Glass'|'Metal'|'Paper'|'Organic'|'Textile'|'General waste';
export interface Survey{id:string;date:string;coverageKm2:number}
export type Source='ai'|'confirmed'|'community';
export type Cleanup='pending'|'in_progress'|'cleaned';
export type Severity='low'|'medium'|'high'|'critical';
export interface Detection{id:string;category:Category;confidence:number;lat:number;lng:number;timestamp:string;surveyId:string;area:string;source:Source;cleanup:Cleanup;image:string;description?:string}
export interface Hotspot{id:string;lat:number;lng:number;count:number;severity:Severity;area:string;categories:Record<string,number>;lastSurvey:string;cleanup:Cleanup;confirmed:boolean;detections:Detection[]}
export type SetDets=Dispatch<SetStateAction<Detection[]>>;
