/**
 * Class representing an API response
 *
 * @template T - The type of the data returned in the response
 *
 * @property {string} status - The status of the response, either "success" or "error"
 * @property {string} message - A message describing the response
 * @property {number} httpStatus - The HTTP status code of the response
 * @property {T | undefined} data - The data returned in the response, or undefined if the response is an error
 */
export class ApiResponse<T> {
    success: boolean;
    message: string;
    httpStatus: number;
    data?: T;

    constructor(
        httpStatus: number,
        message: string,
        data?: T,
        success: boolean = httpStatus < 400,
    ) {
        this.httpStatus = httpStatus;
        this.message = message;
        this.data = data;
        this.success = success;
    }
}
