import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class PermissionAssignmentDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  permissionId!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  granted?: boolean;
}

export class AssignPermissionsDto {
  @ApiProperty({ type: [PermissionAssignmentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionAssignmentDto)
  permissions!: PermissionAssignmentDto[];
}
