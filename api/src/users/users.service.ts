import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
  ) {}

  async findOrCreateByEmail(email: string): Promise<User> {
    let user = await this.usersRepo.findOne({ where: { email } });
    if (!user) {
      user = this.usersRepo.create({ email });
      user = await this.usersRepo.save(user);
    }
    return user;
  }
}
