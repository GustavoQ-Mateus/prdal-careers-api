import { ApiProperty } from '@nestjs/swagger';
import type { HealthResponse } from '@prdal/contracts';

export class HealthResponseDto implements HealthResponse {
  @ApiProperty({ enum: ['api'] })
  service!: HealthResponse['service'];

  @ApiProperty({ enum: ['ok'] })
  status!: HealthResponse['status'];
}
