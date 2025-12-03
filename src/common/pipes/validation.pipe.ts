import {
  type ArgumentMetadata,
  BadRequestException,
  Injectable,
  type PipeTransform,
} from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { type ValidationError, validate } from "class-validator";

@Injectable()
export class ValidationPipe implements PipeTransform {
  async transform(value: unknown, { metatype }: ArgumentMetadata): Promise<unknown> {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    const object = plainToInstance(metatype, value);
    const errors = await validate(object);

    if (errors.length > 0) {
      const messages = this.formatErrors(errors);
      throw new BadRequestException(messages);
    }

    return object;
  }

  // biome-ignore lint/complexity/noBannedTypes: Required for NestJS metatype validation
  private toValidate(metatype: Function): boolean {
    // biome-ignore lint/complexity/noBannedTypes: Checking against built-in constructors
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  private formatErrors(errors: ValidationError[]): string[] {
    return errors.flatMap((error) => {
      if (error.constraints) {
        return Object.values(error.constraints);
      }
      if (error.children && error.children.length > 0) {
        return this.formatErrors(error.children);
      }
      return [];
    });
  }
}
