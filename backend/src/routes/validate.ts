import { Router } from "express";
import { validateBundle } from "../services/validator.js";

export const validateRouter = Router();

validateRouter.post("/validate", (request, response) => {
  const result = validateBundle(request.body);
  response.status(200).json(result);
});
