import { Controller, Get, Route, Tags } from "tsoa";
import { uxpBridge } from "../server";

export interface HealthResponse {
  status: "ok";
  server: "running";
  uxpConnected: boolean;
  timestamp: string;
}

@Route("health")
@Tags("Health")
export class HealthController extends Controller {
  @Get("/")
  public async getHealth(): Promise<HealthResponse> {
    return {
      status: "ok",
      server: "running",
      uxpConnected: uxpBridge.isConnected,
      timestamp: new Date().toISOString(),
    };
  }
}
