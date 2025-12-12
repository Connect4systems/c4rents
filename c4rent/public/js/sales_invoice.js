frappe.ui.form.on("Sales Invoice", {
    onload: function(frm) {
        if (frm.doc.__islocal && cur_frm.doc.selling_price_list == "Daily"){
            if(frm.doc.rent) {
            check_remaining_quantities(frm);
            }
        }

    },
    
    validate: function(frm) {
        validate_remaining_quantities(frm);
    }
});

const check_remaining_quantities = (frm) => {
    frappe.call({
        method: 'c4rent.c4rent.utils.sales_invoice.get_remaining_quantities',
        args: { rent: frm.doc.rent },
        callback: (r) => {
            if(r.message.remaining_items.length === 0) {
                frappe.msgprint({
                    title: __('تحذير'),
                    message: __('تم إصدار جميع الكميات في فواتير سابقة'),
                    indicator: 'orange'
                });
                frm.doc.items = [];
                frm.refresh_field('items');
            }
            else if(frm.doc.__islocal) {
                fetch_items(frm, r.message.remaining_items);
            }
        }
    });
};

const fetch_items = (frm, remaining_items) => {
    // جلب قيمة income_account بشكل غير متزامن
    frappe.db.get_single_value('Rent Settings', 'income_account')
    .then(incomeAccount => {
        if (!incomeAccount) {
            frappe.msgprint({
                title: __("إعدادات ناقصة"),
                indicator: "red",
                message: __("يجب تعبئة حقل 'Income Account' في إعدادات التأجير قبل المتابعة")
            });
            return; // إيقاف التنفيذ إذا لم توجد القيمة
        }

        frm.clear_table('items');
        
        remaining_items.forEach(item => {
            const row = frm.add_child('items');
            row.item_code = item.item_code;
            row.item_name = item.item_name;
            row.description = item.item_name;
            row.income_account = incomeAccount; // استخدام القيمة التي تم جلبها
            row.rate = item.rate;
            row.uom = item.uom;
            row.rent_detail = item.name;
            row.rent_qty = item.remaining_qty;
            
            if(frm.doc.selling_price_list == "Daily") {
                calculate_daily_quantities(frm, item, row);
            }
        });
        
        frm.refresh_field('items');
    })
    .catch(error => {
        console.error('Error fetching income account:', error);
    });
};

const calculate_daily_quantities = (frm, item, row) => {
    frappe.call({
        method: 'frappe.client.get_value',
        args: {
            doctype: 'Rent',
            fieldname: 'date',
            filters: { name: frm.doc.rent }
        },
        callback: (r) => {
            const start_date = new Date(r.message.date);
            const end_date = new Date(frm.doc.posting_date);
            const days = Math.ceil((end_date - start_date) / (1000 * 3600 * 24)) || 1;
            
            row.days = days;
            row.qty = item.remaining_qty * days;
            frm.refresh_field('items');
        }
    });
};

const validate_remaining_quantities = (frm) => {
    if(frm.doc.rent && frm.doc.items.length > 0) {
        frappe.call({
            method: 'c4rent.c4rent.utils.sales_invoice.validate_quantities',
            args: {
                rent: frm.doc.rent,
                items: frm.doc.items
            },
            callback: (r) => {
                if(!r.message.is_valid) {
                    // frappe.throw(__('الكميات المدخلة تتجاوز الكميات المتبقية'));
                }
            }
        });
    }
};

