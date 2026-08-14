import prisma from "../config/db.js";

// ১. নতুন Expense যোগ করা
export const addExpense = async (req, res) => {
    try {
        const { category, amount, note } = req.body;

        const userId = req.user?.id;
        const shopId = req.user?.shopId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: User ID not found",
            });
        }

        if (!shopId) {
            return res.status(400).json({
                success: false,
                message: "Shop ID not found for this user",
            });
        }

        if (!category || amount === undefined || amount === null || amount === "") {
            return res.status(400).json({
                success: false,
                message: "Category and amount are required",
            });
        }

        const newExpense = await prisma.expense.create({
            data: {
                category,
                amount: Number(amount),
                note: note || "",
                shopId: Number(shopId),
                userId: Number(userId),
            },
        });

        return res.status(201).json({
            success: true,
            message: "Expense added successfully",
            data: newExpense,
        });
    } catch (err) {
        console.error("Add Expense Error:", err);

        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
};


// ২. Expense list + Total Expense
export const getExpenses = async (req, res) => {
    try {
        const shopId = req.user?.shopId;
        const { filter, startDate, endDate } = req.query;

        if (!shopId) {
            return res.status(400).json({
                success: false,
                message: "Shop ID not found for this user",
            });
        }

        let dateFilter = {};
        const today = new Date();

        // Today
        if (filter === "today") {
            const startOfDay = new Date(
                today.getFullYear(),
                today.getMonth(),
                today.getDate(),
                0,
                0,
                0,
                0
            );

            const endOfDay = new Date(
                today.getFullYear(),
                today.getMonth(),
                today.getDate(),
                23,
                59,
                59,
                999
            );

            dateFilter = {
                gte: startOfDay,
                lte: endOfDay,
            };
        }

        // Custom date range
        else if (filter === "custom" && startDate && endDate) {
            const startCustom = new Date(startDate);
            startCustom.setHours(0, 0, 0, 0);

            const endCustom = new Date(endDate);
            endCustom.setHours(23, 59, 59, 999);

            dateFilter = {
                gte: startCustom,
                lte: endCustom,
            };
        }

        const expenses = await prisma.expense.findMany({
            where: {
                shopId: Number(shopId),

                ...(Object.keys(dateFilter).length > 0 && {
                    createdAt: dateFilter,
                }),
            },

            orderBy: {
                createdAt: "desc",
            },
        });

        const totalExpense = expenses.reduce(
            (total, expense) =>
                total + (Number(expense.amount) || 0),
            0
        );

        return res.status(200).json({
            success: true,
            totalExpense,
            data: expenses,
        });
    } catch (err) {
        console.error("Get Expense Error:", err);

        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
};


// ৩. Expense Update
export const updateExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const { category, amount, note } = req.body;

        const userId = req.user?.id;
        const shopId = req.user?.shopId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: User ID not found",
            });
        }

        if (!shopId) {
            return res.status(400).json({
                success: false,
                message: "Shop ID not found for this user",
            });
        }

        if (!category || amount === undefined || amount === null || amount === "") {
            return res.status(400).json({
                success: false,
                message: "Category and amount are required",
            });
        }

        // প্রথমে check করবে expense এই shop-এর কিনা
        const existingExpense = await prisma.expense.findFirst({
            where: {
                id: Number(id),
                shopId: Number(shopId),
            },
        });

        if (!existingExpense) {
            return res.status(404).json({
                success: false,
                message: "Expense not found",
            });
        }

        const updatedExpense = await prisma.expense.update({
            where: {
                id: Number(id),
            },
            data: {
                category,
                amount: Number(amount),
                note: note || "",
            },
        });

        return res.status(200).json({
            success: true,
            message: "Expense updated successfully",
            data: updatedExpense,
        });
    } catch (err) {
        console.error("Update Expense Error:", err);

        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
};


// ৪. Expense Delete
export const deleteExpense = async (req, res) => {
    try {
        const { id } = req.params;

        const shopId = req.user?.shopId;

        if (!shopId) {
            return res.status(400).json({
                success: false,
                message: "Shop ID not found for this user",
            });
        }

        // এই expense user-এর shop-এর কিনা check করবে
        const existingExpense = await prisma.expense.findFirst({
            where: {
                id: Number(id),
                shopId: Number(shopId),
            },
        });

        if (!existingExpense) {
            return res.status(404).json({
                success: false,
                message: "Expense not found",
            });
        }

        await prisma.expense.delete({
            where: {
                id: Number(id),
            },
        });

        return res.status(200).json({
            success: true,
            message: "Expense deleted successfully",
        });
    } catch (err) {
        console.error("Delete Expense Error:", err);

        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
};