// create a flexible validator middleware where i can pass the option to validate either query , params, or body
import { NextFunction, Request, Response } from "express";
import { ApiResponse } from "../utils/ApiResponse";
import { StatusCodes } from "http-status-codes";
import { ZodError, ZodType } from "zod";

interface ValidatorOptions {
    check: "body" | "query" | "params";
    validationSchema: ZodType;
}

export function validator(options: ValidatorOptions) {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            if (options.check === "body") {
                options.validationSchema.parse(req.body);
            }
            if (options.check === "query") {
                options.validationSchema.parse(req.query);
            }
            if (options.check === "params") {
                options.validationSchema.parse(req.params);
            }
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const formattedErrors = error.issues;
                return res
                    .status(StatusCodes.BAD_REQUEST)
                    .json(
                        new ApiResponse(
                            StatusCodes.BAD_REQUEST,
                            "Validation error",
                            formattedErrors,
                        ),
                    );
            }
            next(error);
        }
    };
}
