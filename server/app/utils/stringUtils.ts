export function isNullOrWhitespace(value: any): boolean {
    return value == null || 
           typeof value !== 'string' || 
           value.trim().length === 0;
}