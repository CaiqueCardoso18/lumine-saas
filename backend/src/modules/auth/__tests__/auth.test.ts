import request from 'supertest';
import app from '../../../app';
import { prisma } from '../../../config/database';
import bcrypt from 'bcryptjs';

// Limpar usuários de teste antes/depois
beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: 'test-' } } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: 'test-' } } });
  await prisma.$disconnect();
});

describe('Auth — POST /api/auth/register', () => {
  it('deve criar um usuário OWNER com sucesso', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'test-owner@lumine.com',
      password: 'Senha@123',
      name: 'Test Owner',
      role: 'OWNER',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('test-owner@lumine.com');
  });

  it('deve rejeitar email duplicado', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'test-owner@lumine.com',
      password: 'Senha@123',
      name: 'Test Owner 2',
      role: 'EMPLOYEE',
    });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('deve rejeitar senha fraca', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'test-weak@lumine.com',
      password: '123',
      name: 'Weak',
      role: 'EMPLOYEE',
    });
    expect(res.status).toBe(422);
  });
});

describe('Auth — POST /api/auth/login', () => {
  beforeAll(async () => {
    const hash = await bcrypt.hash('Senha@123', 12);
    await prisma.user.upsert({
      where: { email: 'test-login@lumine.com' },
      update: {},
      create: { email: 'test-login@lumine.com', passwordHash: hash, name: 'Test Login', role: 'EMPLOYEE' },
    });
  });

  it('deve logar com credenciais corretas', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'test-login@lumine.com',
      password: 'Senha@123',
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('deve rejeitar senha incorreta', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'test-login@lumine.com',
      password: 'senhaErrada',
    });
    expect(res.status).toBe(401);
  });

  it('deve rejeitar email inexistente', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'naoexiste@lumine.com',
      password: 'qualquerCoisa@1',
    });
    expect(res.status).toBe(401);
  });
});

describe('Auth — GET /api/auth/me', () => {
  it('deve retornar 401 sem token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
