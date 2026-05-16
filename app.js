import express from 'express';
import { PrismaClient } from './generated/prisma/client.js';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const adapter = new PrismaBetterSqlite3({
    url: 'file:./dev.db',
});

const prisma = new PrismaClient({ adapter });

const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

app.get('/', async (req, res, next) => {
    try {
        const search = req.query.search || '';
        const sort = req.query.sort || 'newest';
        const page = Number(req.query.page) || 1;
        const perPage = 10;

        const where = {};

        if (search.trim()) {
            where.title = {
                contains: search.trim()
            };
        }

        let orderBy = { createdAt: 'desc' };

        if (sort === 'oldest') {
            orderBy = { createdAt: 'asc' };
        }

        const total = await prisma.announcement.count({ where });
        const totalPages = Math.ceil(total / perPage);
        const skip = (page - 1) * perPage;

        const announcements = await prisma.announcement.findMany({
            where,
            orderBy,
            skip,
            take: perPage
        });

        res.render('index', {
            announcements,
            search,
            sort,
            currentPage: page,
            totalPages
        });
    } catch (error) {
        next(error);
    }
});

app.get('/announcements', (req, res) => {
    res.render('new', { errors: {}, data: null });
});

app.post('/announcements', async (req, res, next) => {
    try {
        const { title, description, price, category, contactInfo } = req.body;

        const errors = {};
        const validCategories = ['sale', 'service', 'job', 'other'];

        if (!title || title.trim().length < 5) {
            errors.title = 'Title must be at least 5 characters';
        }

        if (!description || description.trim().length < 10) {
            errors.description = 'Description must be at least 10 characters';
        }

        if (!contactInfo || contactInfo.trim().length < 5) {
            errors.contactInfo = 'Contact must be at least 5 characters';
        }

        if (!validCategories.includes(category)) {
            errors.category = 'Choose a category';
        }

        if (!price || Number.isNaN(Number(price)) || Number(price) <= 0) {
            errors.price = 'Price must be a positive number';
        }

        if (Object.keys(errors).length > 0) {
            return res.status(400).render('new', {
                errors,
                data: req.body
            });
        }

        const announcement = await prisma.announcement.create({
            data: {
                title: title.trim(),
                description: description.trim(),
                price: Number(price),
                category,
                contactInfo: contactInfo.trim()
            }
        });

        res.redirect(`/announcements/${announcement.id}`);
    } catch (error) {
        next(error);
    }
});

app.get('/announcements/:id', async (req, res) => {
    const id = Number(req.params.id);

    const announcement = await prisma.announcement.findUnique({
        where: { id }
    });

    if (!announcement) {
        return res.status(404).render('404');
    }

    res.render('announcement', { announcement });
});

app.delete('/announcements/:id', async (req, res, next) => {
    try {
        const id = Number(req.params.id);

        await prisma.announcement.delete({
            where: { id }
        });

        res.status(204).end();
    } catch (error) {
        next(error);
    }
});

app.use((req, res) => {
    res.status(404).render('404');
});

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).render('error');
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});