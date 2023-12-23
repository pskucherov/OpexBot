export class Time {
    static delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static formatDate(date: Date) {
        return date.getFullYear() + '.' + (date.getMonth() + 1) + '.' + date.getDate();
    }
}
