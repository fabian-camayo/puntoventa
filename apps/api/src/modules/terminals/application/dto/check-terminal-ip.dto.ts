import { IsIP, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckTerminalIpDto {
  @ApiProperty()
  @IsUUID()
  branchId!: string;

  @ApiProperty()
  @IsIP('4')
  ipAddress!: string;
}
