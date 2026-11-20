# BuySense roadmap

- [x] Storefront UI: home, catalogue, product detail, compare (5), cart, checkout UI, advisor (AHP/TOPSIS/What-If), admin UI
- [ ] Fix outstanding type errors (admin reports chart config)
- [ ] Inspect existing BuySense-DB schema/data, extend it (structured specs, roles table, addresses, statuses incl. Processing, image storage)
- [ ] Transactional place-order / cancel / status RPCs (stock validation, no overselling)
- [ ] Swap data layer from browser storage to Supabase (auth, products, cart, wishlist, orders, profiles, admin)
- [ ] Login with separate Customer / Admin sign in; Access Denied handling; Supabase password reset
- [ ] Admin: product image upload, categories, customers list, best sellers, order distribution
- [ ] Advisor: add rating criterion from real reviews; save decision history
- [ ] Test customer + admin workflows and security end-to-end
