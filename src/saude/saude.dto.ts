import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ enum: ['api'] })
  service!: 'api';

  @ApiProperty({ enum: ['ok'] })
  status!: 'ok';
}
